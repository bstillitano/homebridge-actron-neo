import { AwayModeAccessory } from './awayModeAccessory';
import { createMockAccessory, mockLogger } from './__mocks__/mockHomebridge';

describe('AwayModeAccessory', () => {
  let accessory: AwayModeAccessory;
  let mockPlatformAccessory: ReturnType<typeof createMockAccessory>;
  let mockPlatform: {
    Service: Record<string, string>;
    Characteristic: Record<string, string>;
    api: { hap: { HapStatusError: unknown; HAPStatus: Record<string, number> } };
    log: typeof mockLogger;
    hvacInstance: {
      type: string;
      cloudConnected: boolean;
      awayMode: boolean;
      setAwayModeOn: jest.Mock;
      setAwayModeOff: jest.Mock;
    };
    softRefreshInterval: number;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    mockPlatformAccessory = createMockAccessory('Away Mode');

    mockPlatform = {
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        Switch: 'Switch',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        On: 'On',
      },
      api: {
        hap: {
          HapStatusError: class extends Error {
            constructor(public status: number) {
              super(`HAP Error: ${status}`);
            }
          },
          HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
        },
      },
      log: mockLogger,
      hvacInstance: {
        type: 'Neo',
        cloudConnected: true,
        awayMode: false,
        setAwayModeOn: jest.fn().mockResolvedValue(true),
        setAwayModeOff: jest.fn().mockResolvedValue(false),
      },
      softRefreshInterval: 5000,
    };

    accessory = new AwayModeAccessory(
      mockPlatform as never,
      mockPlatformAccessory as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create switch service', () => {
      expect(mockPlatformAccessory.addService).toHaveBeenCalled();
    });
  });

  describe('getEnableState', () => {
    it('should return 1 when away mode is on', () => {
      mockPlatform.hvacInstance.awayMode = true;
      const result = accessory.getEnableState();
      expect(result).toBe(1);
    });

    it('should return 0 when away mode is off', () => {
      mockPlatform.hvacInstance.awayMode = false;
      const result = accessory.getEnableState();
      expect(result).toBe(0);
    });
  });

  describe('setEnableState', () => {
    it('should call setAwayModeOn when value is truthy', async () => {
      await accessory.setEnableState(true);
      expect(mockPlatform.hvacInstance.setAwayModeOn).toHaveBeenCalled();
    });

    it('should call setAwayModeOff when value is falsy', async () => {
      await accessory.setEnableState(false);
      expect(mockPlatform.hvacInstance.setAwayModeOff).toHaveBeenCalled();
    });

    it('should throw when cloud is disconnected', async () => {
      mockPlatform.hvacInstance.cloudConnected = false;
      await expect(accessory.setEnableState(true)).rejects.toThrow();
    });
  });

  describe('checkHvacComms', () => {
    it('should throw when cloud is not connected', () => {
      mockPlatform.hvacInstance.cloudConnected = false;
      expect(() => accessory.checkHvacComms()).toThrow();
    });

    it('should not throw when cloud is connected', () => {
      mockPlatform.hvacInstance.cloudConnected = true;
      expect(() => accessory.checkHvacComms()).not.toThrow();
    });
  });

  describe('updateCharacteristics', () => {
    it('should update switch characteristic', async () => {
      await accessory.updateCharacteristics();
      // The update method is called via the interval
    });
  });
});
