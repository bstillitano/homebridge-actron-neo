import QueApi from './queApi';
import { mockLogger } from './__mocks__/mockHomebridge';

// Mock node-fetch
jest.mock('node-fetch', () => {
  const mockFetch = jest.fn();
  return {
    __esModule: true,
    default: mockFetch,
    Request: jest.fn().mockImplementation((url, options) => {
      const headers = new Map(Object.entries(options?.headers || {}));
      return { url, ...options, headers: { set: (k: string, v: string) => headers.set(k, v), get: (k: string) => headers.get(k) } };
    }),
    Response: jest.fn(),
    FetchError: class FetchError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    },
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  writeFile: jest.fn((path, data, callback) => callback?.(null)),
  readFileSync: jest.fn(),
}));

// Get mocked modules
const mockFetch = jest.requireMock('node-fetch').default;
const mockFs = jest.requireMock('fs');

describe('QueApi', () => {
  let api: QueApi;

  const createMockResponse = (status: number, data: object) => ({
    status,
    json: jest.fn().mockResolvedValue(data),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation((path: string) => {
      if (path.includes('access.token')) {
        return JSON.stringify({ expires: Date.now() + 100000, token: 'mock-refresh-token' });
      }
      if (path.includes('bearer.token')) {
        return JSON.stringify({ expires: Date.now() + 100000, token: 'mock-bearer-token' });
      }
      if (path.includes('clientid.token')) {
        return JSON.stringify([{ name: 'test-client', id: 'test-client-12345' }]);
      }
      return '{}';
    });

    api = new QueApi(
      'test@example.com',
      'password123',
      'test-client',
      mockLogger,
      '/test/storage',
      'SERIAL123',
    );
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      expect(api.actronSerial).toBe('SERIAL123');
    });

    it('should create persistent data directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      new QueApi(
        'test@example.com',
        'password123',
        'new-client',
        mockLogger,
        '/test/storage',
      );

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it('should read existing tokens from files', () => {
      expect(api.refreshToken.token).toBe('mock-refresh-token');
      expect(api.bearerToken.token).toBe('mock-bearer-token');
    });
  });

  describe('generateClientId', () => {
    it('should generate a client ID with the client name prefix', () => {
      const clientId = api.generateClientId();
      expect(clientId).toMatch(/^test-client-\d{5}$/);
    });

    it('should generate a random 5-digit number', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        ids.add(api.generateClientId());
      }
      // With random numbers, we should get mostly unique values
      expect(ids.size).toBeGreaterThan(1);
    });
  });

  describe('manageApiRequest', () => {
    it('should return JSON on successful response', async () => {
      const mockData = { success: true };
      mockFetch.mockResolvedValue(createMockResponse(200, mockData));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never);

      expect(result).toEqual(mockData);
    });

    it('should throw after max retries on 401', async () => {
      mockFetch.mockResolvedValue(createMockResponse(401, {}));

      await expect(
        api.manageApiRequest({ headers: { set: jest.fn() } } as never, 1),
      ).rejects.toThrow('Maximum retires exceeded');
    });

    it('should clear tokens on 401 max retries', async () => {
      mockFetch.mockResolvedValue(createMockResponse(401, {}));

      try {
        await api.manageApiRequest({ headers: { set: jest.fn() } } as never, 1);
      } catch {
        // Expected to throw
      }

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('access.token'),
        expect.stringContaining('"expires": 0'),
      );
    });

    it('should throw on 400 error', async () => {
      mockFetch.mockResolvedValue(createMockResponse(400, {}));

      await expect(
        api.manageApiRequest({ headers: { set: jest.fn() } } as never),
      ).rejects.toThrow('username or password issue');
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(503, {}))
        .mockResolvedValueOnce(createMockResponse(200, { success: true }));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never, 2, 0);

      expect(result).toEqual({ success: true });
    });

    it('should return error response after max retries on 5xx', async () => {
      mockFetch.mockResolvedValue(createMockResponse(500, {}));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never, 1, 0);

      expect(result).toHaveProperty('apiAccessError');
    });

    it('should handle EHOSTDOWN network error', async () => {
      const FetchError = jest.requireMock('node-fetch').FetchError;
      mockFetch.mockRejectedValue(new FetchError('Network error', 'EHOSTDOWN'));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never);

      expect(result).toHaveProperty('apiAccessError');
    });

    it('should handle ETIMEDOUT network error', async () => {
      const FetchError = jest.requireMock('node-fetch').FetchError;
      mockFetch.mockRejectedValue(new FetchError('Timeout', 'ETIMEDOUT'));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never);

      expect(result).toHaveProperty('apiAccessError');
    });

    it('should handle ENETUNREACH network error', async () => {
      const FetchError = jest.requireMock('node-fetch').FetchError;
      mockFetch.mockRejectedValue(new FetchError('Network unreachable', 'ENETUNREACH'));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never);

      expect(result).toHaveProperty('apiAccessError');
    });

    it('should handle EAI_AGAIN network error', async () => {
      const FetchError = jest.requireMock('node-fetch').FetchError;
      mockFetch.mockRejectedValue(new FetchError('DNS error', 'EAI_AGAIN'));

      const result = await api.manageApiRequest({ headers: { set: jest.fn() } } as never);

      expect(result).toHaveProperty('apiAccessError');
    });

    it('should throw on unexpected fetch errors', async () => {
      const FetchError = jest.requireMock('node-fetch').FetchError;
      mockFetch.mockRejectedValue(new FetchError('Unknown error', 'UNKNOWN'));

      await expect(
        api.manageApiRequest({ headers: { set: jest.fn() } } as never),
      ).rejects.toThrow('Unexpected error');
    });

    it('should throw on unhandled status codes', async () => {
      mockFetch.mockResolvedValue(createMockResponse(418, {})); // I'm a teapot

      await expect(
        api.manageApiRequest({ headers: { set: jest.fn() } } as never),
      ).rejects.toThrow('unhandled error');
    });
  });

  describe('token management', () => {
    it('should store tokens in instance', () => {
      expect(api.refreshToken).toBeDefined();
      expect(api.bearerToken).toBeDefined();
    });

    it('should have token expiry tracking', () => {
      expect(api.refreshToken.expires).toBeGreaterThan(0);
      expect(api.bearerToken.expires).toBeGreaterThan(0);
    });
  });
});
