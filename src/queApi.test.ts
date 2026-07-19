import QueApi from './queApi';
import { validApiCommands } from './types';
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

  describe('command pipeline', () => {
    const MockRequest = jest.requireMock('node-fetch').Request;
    // The request options passed to `new Request(url, options)` for the Nth send, in order.
    const sentOptions = (index: number) => MockRequest.mock.calls[index][1];
    const sentBody = (index: number) => JSON.parse(sentOptions(index).body).command;

    const seedZones = (zones: boolean[]) => {
      (api as unknown as { enabledZones: boolean[] }).enabledZones = zones;
    };

    beforeEach(() => {
      jest.useFakeTimers();
      // Every POST acks successfully.
      mockFetch.mockResolvedValue(createMockResponse(200, { type: 'ack' }));
      // Fast debounce window for tests.
      api = new QueApi('test@example.com', 'password123', 'test-client', mockLogger, '/test/storage', 'SERIAL123', 50);
      // Only count Request constructions from here on (the constructor above builds none).
      MockRequest.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('coalesces a rapid multi-zone toggle into a single command carrying every change', async () => {
      seedZones([false, false, false]);

      const p0 = api.runCommand(validApiCommands.ZONE_ENABLE, 0, 0, 0);
      const p1 = api.runCommand(validApiCommands.ZONE_ENABLE, 0, 0, 1);
      const p2 = api.runCommand(validApiCommands.ZONE_ENABLE, 0, 0, 2);

      await jest.advanceTimersByTimeAsync(50);
      await Promise.all([p0, p1, p2]);

      // One POST, not three, and it contains all three toggles merged together.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sentBody(0)['UserAirconSettings.EnabledZones']).toEqual([true, true, true]);
    });

    it('does not re-read cloud zone state per toggle (no GET before the send)', async () => {
      seedZones([false, false, false]);

      const p = api.runCommand(validApiCommands.ZONE_ENABLE, 0, 0, 1);
      await jest.advanceTimersByTimeAsync(50);
      await p;

      // Exactly one request total: the POST. The old code issued a GET per command first.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(MockRequest.mock.calls).toHaveLength(1);
      expect(sentOptions(0).method).toBe('POST');
    });

    it('sends only the final value when a setpoint is changed rapidly', async () => {
      const p0 = api.runCommand(validApiCommands.COOL_SET_POINT, 21, 0);
      const p1 = api.runCommand(validApiCommands.COOL_SET_POINT, 22, 0);
      const p2 = api.runCommand(validApiCommands.COOL_SET_POINT, 23, 0);

      await jest.advanceTimersByTimeAsync(50);
      await Promise.all([p0, p1, p2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sentBody(0)['UserAirconSettings.TemperatureSetpoint_Cool_oC']).toBe(23);
    });

    it('serialises distinct commands in the order they were issued', async () => {
      const pZone = api.runCommand(validApiCommands.ON);
      const pTemp = api.runCommand(validApiCommands.COOL_SET_POINT, 24, 0);

      await jest.advanceTimersByTimeAsync(50);
      await Promise.all([pZone, pTemp]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Power command was issued first, so it is sent first.
      expect(sentBody(0)['UserAirconSettings.isOn']).toBe(true);
      expect(sentBody(1)['UserAirconSettings.TemperatureSetpoint_Cool_oC']).toBe(24);
    });

    it('resolves every coalesced caller with the command result', async () => {
      const p0 = api.runCommand(validApiCommands.COOL_SET_POINT, 21, 0);
      const p1 = api.runCommand(validApiCommands.COOL_SET_POINT, 22, 0);

      await jest.advanceTimersByTimeAsync(50);

      await expect(p0).resolves.toBe('SUCCESS');
      await expect(p1).resolves.toBe('SUCCESS');
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
