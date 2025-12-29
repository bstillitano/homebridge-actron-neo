import { ActronQuePlatform } from './platform';
import { createMockApi, createMockConfig, mockLogger } from './__mocks__/mockHomebridge';

// Mock the HvacUnit module
jest.mock('./hvac', () => ({
  HvacUnit: jest.fn().mockImplementation(() => ({
    actronQueApi: jest.fn().mockResolvedValue('TEST123456'),
    getStatus: jest.fn().mockResolvedValue({ apiError: false, zoneCurrentStatus: [] }),
    serialNo: 'TEST123456',
    type: 'Neo',
    name: 'Test AC',
    zoneInstances: [],
    awayMode: false,
    quietMode: false,
    continuousFanMode: false,
  })),
}));

describe('ActronQuePlatform', () => {
  let platform: ActronQuePlatform;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi();
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      const config = createMockConfig();
      platform = new ActronQuePlatform(mockLogger, config, mockApi);

      expect(platform.config).toBe(config);
      expect(platform.log).toBe(mockLogger);
    });

    it('should log error if username is missing', () => {
      const config = createMockConfig({ username: undefined });

      new ActronQuePlatform(mockLogger, config, mockApi);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Username is not configured'),
      );
    });

    it('should log error if password is missing', () => {
      const config = createMockConfig({ password: undefined });

      new ActronQuePlatform(mockLogger, config, mockApi);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Password is not configured'),
      );
    });

    it('should log error if clientName is missing', () => {
      const config = createMockConfig({ clientName: undefined });

      new ActronQuePlatform(mockLogger, config, mockApi);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Client Name is not configured'),
      );
    });

    it('should use default values for optional config', () => {
      const config = createMockConfig({
        refreshInterval: undefined,
        maxCoolingTemp: undefined,
        minCoolingTemp: undefined,
      });
      platform = new ActronQuePlatform(mockLogger, config, mockApi);

      expect(platform.softRefreshInterval).toBe(5000); // Default soft refresh
    });

    it('should apply config overrides', () => {
      const config = createMockConfig({
        zonesAsHeaterCoolers: true,
        maxCoolingTemp: 30,
        minCoolingTemp: 18,
      });
      platform = new ActronQuePlatform(mockLogger, config, mockApi);

      expect(platform.zonesAsHeaterCoolers).toBe(true);
      expect(platform.maxCoolingTemp).toBe(30);
      expect(platform.minCoolingTemp).toBe(18);
    });
  });

  describe('configureAccessory', () => {
    it('should cache accessories', () => {
      const config = createMockConfig();
      platform = new ActronQuePlatform(mockLogger, config, mockApi);

      const mockAccessory = {
        UUID: 'test-uuid',
        displayName: 'Test Accessory',
        context: {},
      };

      platform.configureAccessory(mockAccessory as never);

      expect(platform.accessories).toHaveLength(1);
      expect(platform.accessories[0]).toBe(mockAccessory);
    });
  });

  describe('config validation', () => {
    it('should validate required fields', () => {
      const validConfig = createMockConfig();
      expect(() => {
        new ActronQuePlatform(mockLogger, validConfig, mockApi);
      }).not.toThrow();
    });

    it('should accept empty deviceSerial', () => {
      const config = createMockConfig({ deviceSerial: '' });
      expect(() => {
        new ActronQuePlatform(mockLogger, config, mockApi);
      }).not.toThrow();
    });
  });
});
