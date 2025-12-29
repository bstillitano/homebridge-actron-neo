import { MasterControllerAccessory } from './masterControllerAccessory';
import { PowerState, ClimateMode, CompressorMode, FanMode } from './types';
import { createMockAccessory, mockLogger } from './__mocks__/mockHomebridge';

describe('MasterControllerAccessory', () => {
  let accessory: MasterControllerAccessory;
  let mockPlatformAccessory: ReturnType<typeof createMockAccessory>;
  let mockPlatform: {
    Service: Record<string, string>;
    Characteristic: Record<string, unknown>;
    api: { hap: { HapStatusError: unknown; HAPStatus: Record<string, number> } };
    log: typeof mockLogger;
    hvacInstance: {
      type: string;
      serialNo: string;
      cloudConnected: boolean;
      powerState: PowerState;
      climateMode: ClimateMode;
      compressorMode: CompressorMode;
      fanMode: FanMode;
      fanRunning: boolean;
      masterCurrentTemp: number;
      masterHumidity: number;
      masterHeatingSetTemp: number;
      masterCoolingSetTemp: number;
      getStatus: jest.Mock;
      setPowerStateOn: jest.Mock;
      setPowerStateOff: jest.Mock;
      setClimateModeAuto: jest.Mock;
      setClimateModeHeat: jest.Mock;
      setClimateModeCool: jest.Mock;
      setHeatTemp: jest.Mock;
      setCoolTemp: jest.Mock;
      setFanModeAuto: jest.Mock;
      setFanModeLow: jest.Mock;
      setFanModeMedium: jest.Mock;
      setFanModeHigh: jest.Mock;
    };
    hardRefreshInterval: number;
    softRefreshInterval: number;
    minHeatingTemp: number;
    maxHeatingTemp: number;
    minCoolingTemp: number;
    maxCoolingTemp: number;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    mockPlatformAccessory = createMockAccessory('Master Controller');

    mockPlatform = {
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        HeaterCooler: 'HeaterCooler',
        HumiditySensor: 'HumiditySensor',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        Active: 'Active',
        CurrentHeaterCoolerState: 'CurrentHeaterCoolerState',
        TargetHeaterCoolerState: { AUTO: 0, HEAT: 1, COOL: 2 },
        CurrentTemperature: 'CurrentTemperature',
        HeatingThresholdTemperature: 'HeatingThresholdTemperature',
        CoolingThresholdTemperature: 'CoolingThresholdTemperature',
        RotationSpeed: 'RotationSpeed',
        CurrentRelativeHumidity: 'CurrentRelativeHumidity',
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
        serialNo: 'TEST123456',
        cloudConnected: true,
        powerState: PowerState.ON,
        climateMode: ClimateMode.COOL,
        compressorMode: CompressorMode.COOL,
        fanMode: FanMode.AUTO,
        fanRunning: true,
        masterCurrentTemp: 23.5,
        masterHumidity: 50,
        masterHeatingSetTemp: 20,
        masterCoolingSetTemp: 24,
        getStatus: jest.fn().mockResolvedValue({ apiError: false, cloudConnected: true }),
        setPowerStateOn: jest.fn().mockResolvedValue(PowerState.ON),
        setPowerStateOff: jest.fn().mockResolvedValue(PowerState.OFF),
        setClimateModeAuto: jest.fn().mockResolvedValue(ClimateMode.AUTO),
        setClimateModeHeat: jest.fn().mockResolvedValue(ClimateMode.HEAT),
        setClimateModeCool: jest.fn().mockResolvedValue(ClimateMode.COOL),
        setHeatTemp: jest.fn().mockResolvedValue(20),
        setCoolTemp: jest.fn().mockResolvedValue(24),
        setFanModeAuto: jest.fn().mockResolvedValue(FanMode.AUTO),
        setFanModeLow: jest.fn().mockResolvedValue(FanMode.LOW),
        setFanModeMedium: jest.fn().mockResolvedValue(FanMode.MEDIUM),
        setFanModeHigh: jest.fn().mockResolvedValue(FanMode.HIGH),
      },
      hardRefreshInterval: 60000,
      softRefreshInterval: 5000,
      minHeatingTemp: 10,
      maxHeatingTemp: 26,
      minCoolingTemp: 20,
      maxCoolingTemp: 32,
    };

    accessory = new MasterControllerAccessory(
      mockPlatform as never,
      mockPlatformAccessory as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create heater cooler service', () => {
      expect(mockPlatformAccessory.addService).toHaveBeenCalled();
    });
  });

  describe('getPowerState', () => {
    it('should return 1 when power is ON', () => {
      mockPlatform.hvacInstance.powerState = PowerState.ON;
      const result = accessory.getPowerState();
      expect(result).toBe(1);
    });

    it('should return 0 when power is OFF', () => {
      mockPlatform.hvacInstance.powerState = PowerState.OFF;
      const result = accessory.getPowerState();
      expect(result).toBe(0);
    });
  });

  describe('setPowerState', () => {
    it('should call setPowerStateOff when value is 0', async () => {
      await accessory.setPowerState(0);
      expect(mockPlatform.hvacInstance.setPowerStateOff).toHaveBeenCalled();
    });

    it('should call setPowerStateOn when value is 1', async () => {
      await accessory.setPowerState(1);
      expect(mockPlatform.hvacInstance.setPowerStateOn).toHaveBeenCalled();
    });

    it('should throw when cloud is disconnected', async () => {
      mockPlatform.hvacInstance.cloudConnected = false;
      await expect(accessory.setPowerState(1)).rejects.toThrow();
    });
  });

  describe('getCurrentCompressorMode', () => {
    it('should return 0 for OFF', () => {
      mockPlatform.hvacInstance.compressorMode = CompressorMode.OFF;
      mockPlatform.hvacInstance.fanRunning = true;
      const result = accessory.getCurrentCompressorMode();
      expect(result).toBe(0);
    });

    it('should return 2 for HEAT', () => {
      mockPlatform.hvacInstance.compressorMode = CompressorMode.HEAT;
      mockPlatform.hvacInstance.fanRunning = true;
      const result = accessory.getCurrentCompressorMode();
      expect(result).toBe(2);
    });

    it('should return 3 for COOL', () => {
      mockPlatform.hvacInstance.compressorMode = CompressorMode.COOL;
      mockPlatform.hvacInstance.fanRunning = true;
      const result = accessory.getCurrentCompressorMode();
      expect(result).toBe(3);
    });

    it('should return 1 (idle) when fan is not running', () => {
      mockPlatform.hvacInstance.compressorMode = CompressorMode.COOL;
      mockPlatform.hvacInstance.fanRunning = false;
      const result = accessory.getCurrentCompressorMode();
      expect(result).toBe(1);
    });

    it('should return 0 for UNKNOWN mode', () => {
      mockPlatform.hvacInstance.compressorMode = CompressorMode.UNKNOWN;
      mockPlatform.hvacInstance.fanRunning = true;
      const result = accessory.getCurrentCompressorMode();
      expect(result).toBe(0);
    });
  });

  describe('getTargetClimateMode', () => {
    it('should return AUTO for ClimateMode.AUTO', () => {
      mockPlatform.hvacInstance.climateMode = ClimateMode.AUTO;
      const result = accessory.getTargetClimateMode();
      expect(result).toBe(0); // AUTO
    });

    it('should return HEAT for ClimateMode.HEAT', () => {
      mockPlatform.hvacInstance.climateMode = ClimateMode.HEAT;
      const result = accessory.getTargetClimateMode();
      expect(result).toBe(1); // HEAT
    });

    it('should return COOL for ClimateMode.COOL', () => {
      mockPlatform.hvacInstance.climateMode = ClimateMode.COOL;
      const result = accessory.getTargetClimateMode();
      expect(result).toBe(2); // COOL
    });

    it('should return 0 for unknown mode', () => {
      mockPlatform.hvacInstance.climateMode = ClimateMode.UNKNOWN;
      const result = accessory.getTargetClimateMode();
      expect(result).toBe(0);
    });
  });

  describe('setTargetClimateMode', () => {
    it('should call setClimateModeAuto for AUTO', async () => {
      await accessory.setTargetClimateMode(0);
      expect(mockPlatform.hvacInstance.setClimateModeAuto).toHaveBeenCalled();
    });

    it('should call setClimateModeHeat for HEAT', async () => {
      await accessory.setTargetClimateMode(1);
      expect(mockPlatform.hvacInstance.setClimateModeHeat).toHaveBeenCalled();
    });

    it('should call setClimateModeCool for COOL', async () => {
      await accessory.setTargetClimateMode(2);
      expect(mockPlatform.hvacInstance.setClimateModeCool).toHaveBeenCalled();
    });
  });

  describe('getCurrentTemperature', () => {
    it('should return master current temperature', () => {
      mockPlatform.hvacInstance.masterCurrentTemp = 25.5;
      const result = accessory.getCurrentTemperature();
      expect(result).toBe(25.5);
    });
  });

  describe('getHumidity', () => {
    it('should return master humidity', () => {
      mockPlatform.hvacInstance.masterHumidity = 55;
      const result = accessory.getHumidity();
      expect(result).toBe(55);
    });
  });

  describe('getHeatingThresholdTemperature', () => {
    it('should return master heating set temp', () => {
      mockPlatform.hvacInstance.masterHeatingSetTemp = 22;
      const result = accessory.getHeatingThresholdTemperature();
      expect(result).toBe(22);
    });
  });

  describe('setHeatingThresholdTemperature', () => {
    it('should call setHeatTemp and getStatus', async () => {
      await accessory.setHeatingThresholdTemperature(22);
      expect(mockPlatform.hvacInstance.setHeatTemp).toHaveBeenCalledWith(22);
      expect(mockPlatform.hvacInstance.getStatus).toHaveBeenCalled();
    });
  });

  describe('getCoolingThresholdTemperature', () => {
    it('should return master cooling set temp', () => {
      mockPlatform.hvacInstance.masterCoolingSetTemp = 26;
      const result = accessory.getCoolingThresholdTemperature();
      expect(result).toBe(26);
    });
  });

  describe('setCoolingThresholdTemperature', () => {
    it('should call setCoolTemp and getStatus', async () => {
      await accessory.setCoolingThresholdTemperature(26);
      expect(mockPlatform.hvacInstance.setCoolTemp).toHaveBeenCalledWith(26);
      expect(mockPlatform.hvacInstance.getStatus).toHaveBeenCalled();
    });
  });

  describe('getFanMode', () => {
    it('should return 100 for AUTO', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.AUTO;
      const result = accessory.getFanMode();
      expect(result).toBe(100);
    });

    it('should return 100 for AUTO_CONT', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.AUTO_CONT;
      const result = accessory.getFanMode();
      expect(result).toBe(100);
    });

    it('should return 29 for LOW', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.LOW;
      const result = accessory.getFanMode();
      expect(result).toBe(29);
    });

    it('should return 59 for MEDIUM', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.MEDIUM;
      const result = accessory.getFanMode();
      expect(result).toBe(59);
    });

    it('should return 89 for HIGH', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.HIGH;
      const result = accessory.getFanMode();
      expect(result).toBe(89);
    });

    it('should return 0 for UNKNOWN', () => {
      mockPlatform.hvacInstance.fanMode = FanMode.UNKNOWN;
      const result = accessory.getFanMode();
      expect(result).toBe(0);
    });
  });

  describe('setFanMode', () => {
    it('should call setFanModeLow for values <= 30', async () => {
      await accessory.setFanMode(25);
      expect(mockPlatform.hvacInstance.setFanModeLow).toHaveBeenCalled();
    });

    it('should call setFanModeMedium for values <= 60', async () => {
      await accessory.setFanMode(50);
      expect(mockPlatform.hvacInstance.setFanModeMedium).toHaveBeenCalled();
    });

    it('should call setFanModeHigh for values <= 90', async () => {
      await accessory.setFanMode(75);
      expect(mockPlatform.hvacInstance.setFanModeHigh).toHaveBeenCalled();
    });

    it('should call setFanModeAuto for values <= 100', async () => {
      await accessory.setFanMode(95);
      expect(mockPlatform.hvacInstance.setFanModeAuto).toHaveBeenCalled();
    });

    it('should log error for invalid value', async () => {
      await accessory.setFanMode('invalid');
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid fan mode value');
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

  describe('hardUpdateDeviceCharacteristics', () => {
    it('should log info on API error', async () => {
      mockPlatform.hvacInstance.getStatus.mockResolvedValue({ apiError: true });
      await accessory.hardUpdateDeviceCharacteristics();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('cloud error'));
    });

    it('should log error when controller is offline', async () => {
      mockPlatform.hvacInstance.getStatus.mockResolvedValue({ apiError: false, cloudConnected: false });
      await accessory.hardUpdateDeviceCharacteristics();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log debug on success', async () => {
      mockPlatform.hvacInstance.getStatus.mockResolvedValue({ apiError: false, cloudConnected: true });
      await accessory.hardUpdateDeviceCharacteristics();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully refreshed'));
    });
  });
});
