import { ZoneControllerAccessory } from './zoneControllerAccessory';
import { ClimateMode, CompressorMode } from './types';
import { createMockAccessory, mockLogger } from './__mocks__/mockHomebridge';

describe('ZoneControllerAccessory', () => {
  let accessory: ZoneControllerAccessory;
  let mockPlatformAccessory: ReturnType<typeof createMockAccessory>;
  let mockZone: {
    zoneName: string;
    sensorId: string;
    zoneEnabled: boolean;
    currentTemp: number;
    currentHumidity: number;
    zoneSensorBattery: number;
    currentHeatingSetTemp: number;
    currentCoolingSetTemp: number;
    minHeatSetPoint: number;
    maxHeatSetPoint: number;
    minCoolSetPoint: number;
    maxCoolSetPoint: number;
    setZoneEnable: jest.Mock;
    setZoneDisable: jest.Mock;
    setHeatTemp: jest.Mock;
    setCoolTemp: jest.Mock;
  };
  let mockPlatform: {
    Service: Record<string, string>;
    Characteristic: Record<string, unknown>;
    api: { hap: { HapStatusError: unknown; HAPStatus: Record<string, number> } };
    log: typeof mockLogger;
    hvacInstance: {
      type: string;
      cloudConnected: boolean;
      compressorMode: CompressorMode;
      climateMode: ClimateMode;
      fanRunning: boolean;
    };
    softRefreshInterval: number;
    zonesAsHeaterCoolers: boolean;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    mockPlatformAccessory = createMockAccessory('Zone 1');

    mockZone = {
      zoneName: 'Zone 1',
      sensorId: 'SENSOR123',
      zoneEnabled: true,
      currentTemp: 23.5,
      currentHumidity: 50,
      zoneSensorBattery: 80,
      currentHeatingSetTemp: 20,
      currentCoolingSetTemp: 24,
      minHeatSetPoint: 16,
      maxHeatSetPoint: 26,
      minCoolSetPoint: 20,
      maxCoolSetPoint: 32,
      setZoneEnable: jest.fn().mockResolvedValue(true),
      setZoneDisable: jest.fn().mockResolvedValue(false),
      setHeatTemp: jest.fn().mockResolvedValue(20),
      setCoolTemp: jest.fn().mockResolvedValue(24),
    };

    mockPlatform = {
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        Switch: 'Switch',
        HeaterCooler: 'HeaterCooler',
        TemperatureSensor: 'TemperatureSensor',
        HumiditySensor: 'HumiditySensor',
        Battery: 'Battery',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        On: 'On',
        Active: { ACTIVE: 1, INACTIVE: 0 },
        CurrentHeaterCoolerState: { IDLE: 1, HEATING: 2, COOLING: 3 },
        TargetHeaterCoolerState: { AUTO: 0, HEAT: 1, COOL: 2 },
        CurrentTemperature: 'CurrentTemperature',
        HeatingThresholdTemperature: 'HeatingThresholdTemperature',
        CoolingThresholdTemperature: 'CoolingThresholdTemperature',
        CurrentRelativeHumidity: 'CurrentRelativeHumidity',
        BatteryLevel: 'BatteryLevel',
        ChargingState: { NOT_CHARGEABLE: 2 },
        StatusLowBattery: { BATTERY_LEVEL_NORMAL: 0, BATTERY_LEVEL_LOW: 1 },
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
        compressorMode: CompressorMode.COOL,
        climateMode: ClimateMode.COOL,
        fanRunning: true,
      },
      softRefreshInterval: 5000,
      zonesAsHeaterCoolers: false,
    };

    accessory = new ZoneControllerAccessory(
      mockPlatform as never,
      mockPlatformAccessory as never,
      mockZone as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Switch mode (default)', () => {
    describe('constructor', () => {
      it('should create switch service', () => {
        expect(mockPlatformAccessory.addService).toHaveBeenCalled();
      });
    });

    describe('getEnableState', () => {
      it('should return 1 when zone is enabled', () => {
        mockZone.zoneEnabled = true;
        const result = accessory.getEnableState();
        expect(result).toBe(1);
      });

      it('should return 0 when zone is disabled', () => {
        mockZone.zoneEnabled = false;
        const result = accessory.getEnableState();
        expect(result).toBe(0);
      });
    });

    describe('setEnableState', () => {
      it('should call setZoneEnable when value is truthy', async () => {
        await accessory.setEnableState(true);
        expect(mockZone.setZoneEnable).toHaveBeenCalled();
      });

      it('should call setZoneDisable when value is falsy', async () => {
        await accessory.setEnableState(false);
        expect(mockZone.setZoneDisable).toHaveBeenCalled();
      });

      it('should throw when cloud is disconnected', async () => {
        mockPlatform.hvacInstance.cloudConnected = false;
        await expect(accessory.setEnableState(true)).rejects.toThrow();
      });
    });
  });

  describe('HeaterCooler mode', () => {
    beforeEach(() => {
      mockPlatform.zonesAsHeaterCoolers = true;
      accessory = new ZoneControllerAccessory(
        mockPlatform as never,
        mockPlatformAccessory as never,
        mockZone as never,
      );
    });

    describe('getActiveState', () => {
      it('should return ACTIVE when zone is enabled', () => {
        mockZone.zoneEnabled = true;
        const result = accessory.getActiveState();
        expect(result).toBe(1); // ACTIVE
      });

      it('should return INACTIVE when zone is disabled', () => {
        mockZone.zoneEnabled = false;
        const result = accessory.getActiveState();
        expect(result).toBe(0); // INACTIVE
      });
    });

    describe('setActiveState', () => {
      it('should call setZoneEnable when value is ACTIVE', async () => {
        await accessory.setActiveState(1);
        expect(mockZone.setZoneEnable).toHaveBeenCalled();
      });

      it('should call setZoneDisable when value is INACTIVE', async () => {
        await accessory.setActiveState(0);
        expect(mockZone.setZoneDisable).toHaveBeenCalled();
      });
    });

    describe('getCurrentHeaterCoolerState', () => {
      it('should return COOLING when compressor is cooling', () => {
        mockPlatform.hvacInstance.compressorMode = CompressorMode.COOL;
        mockPlatform.hvacInstance.fanRunning = true;
        const result = accessory.getCurrentHeaterCoolerState();
        expect(result).toBe(3); // COOLING
      });

      it('should return HEATING when compressor is heating', () => {
        mockPlatform.hvacInstance.compressorMode = CompressorMode.HEAT;
        mockPlatform.hvacInstance.fanRunning = true;
        const result = accessory.getCurrentHeaterCoolerState();
        expect(result).toBe(2); // HEATING
      });

      it('should return IDLE when compressor is off', () => {
        mockPlatform.hvacInstance.compressorMode = CompressorMode.OFF;
        mockPlatform.hvacInstance.fanRunning = true;
        const result = accessory.getCurrentHeaterCoolerState();
        expect(result).toBe(1); // IDLE
      });

      it('should return IDLE when fan is not running', () => {
        mockPlatform.hvacInstance.compressorMode = CompressorMode.COOL;
        mockPlatform.hvacInstance.fanRunning = false;
        const result = accessory.getCurrentHeaterCoolerState();
        expect(result).toBe(1); // IDLE
      });

      it('should return IDLE for unknown compressor mode', () => {
        mockPlatform.hvacInstance.compressorMode = CompressorMode.UNKNOWN;
        mockPlatform.hvacInstance.fanRunning = true;
        const result = accessory.getCurrentHeaterCoolerState();
        expect(result).toBe(1); // IDLE
      });
    });

    describe('getTargetHeaterCoolerState', () => {
      it('should return AUTO for ClimateMode.AUTO', () => {
        mockPlatform.hvacInstance.climateMode = ClimateMode.AUTO;
        const result = accessory.getTargetHeaterCoolerState();
        expect(result).toBe(0); // AUTO
      });

      it('should return HEAT for ClimateMode.HEAT', () => {
        mockPlatform.hvacInstance.climateMode = ClimateMode.HEAT;
        const result = accessory.getTargetHeaterCoolerState();
        expect(result).toBe(1); // HEAT
      });

      it('should return COOL for ClimateMode.COOL', () => {
        mockPlatform.hvacInstance.climateMode = ClimateMode.COOL;
        const result = accessory.getTargetHeaterCoolerState();
        expect(result).toBe(2); // COOL
      });

      it('should return AUTO for unknown climate mode', () => {
        mockPlatform.hvacInstance.climateMode = ClimateMode.UNKNOWN;
        const result = accessory.getTargetHeaterCoolerState();
        expect(result).toBe(0); // AUTO
      });
    });

    describe('temperature threshold setters/getters', () => {
      it('should return heating threshold temperature', () => {
        mockZone.currentHeatingSetTemp = 22;
        const result = accessory.getHeatingThresholdTemperature();
        expect(result).toBe(22);
      });

      it('should set heating threshold temperature', async () => {
        await accessory.setHeatingThresholdTemperature(22);
        expect(mockZone.setHeatTemp).toHaveBeenCalledWith(22);
      });

      it('should return cooling threshold temperature', () => {
        mockZone.currentCoolingSetTemp = 26;
        const result = accessory.getCoolingThresholdTemperature();
        expect(result).toBe(26);
      });

      it('should set cooling threshold temperature', async () => {
        await accessory.setCoolingThresholdTemperature(26);
        expect(mockZone.setCoolTemp).toHaveBeenCalledWith(26);
      });
    });
  });

  describe('Common functionality', () => {
    describe('getCurrentTemperature', () => {
      it('should return current zone temperature', () => {
        mockZone.currentTemp = 25.5;
        const result = accessory.getCurrentTemperature();
        expect(result).toBe(25.5);
      });
    });

    describe('getHumidity', () => {
      it('should return current humidity', () => {
        mockZone.currentHumidity = 55;
        const result = accessory.getHumidity();
        expect(result).toBe(55);
      });

      it('should return 0 when humidity is not a number', () => {
        mockZone.currentHumidity = undefined as never;
        const result = accessory.getHumidity();
        expect(result).toBe(0);
      });
    });

    describe('getBatteryLevel', () => {
      it('should return battery level', () => {
        mockZone.zoneSensorBattery = 75;
        const result = accessory.getBatteryLevel();
        expect(result).toBe(75);
      });
    });

    describe('getChargingState', () => {
      it('should return NOT_CHARGEABLE', () => {
        const result = accessory.getChargingState();
        expect(result).toBe(2); // NOT_CHARGEABLE
      });
    });

    describe('getLowBatteryStatus', () => {
      it('should return BATTERY_LEVEL_NORMAL when battery > 20%', () => {
        mockZone.zoneSensorBattery = 80;
        const result = accessory.getLowBatteryStatus();
        expect(result).toBe(0); // BATTERY_LEVEL_NORMAL
      });

      it('should return BATTERY_LEVEL_LOW when battery < 20%', () => {
        mockZone.zoneSensorBattery = 15;
        const result = accessory.getLowBatteryStatus();
        expect(result).toBe(1); // BATTERY_LEVEL_LOW
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
      it('should update characteristics in switch mode', async () => {
        mockPlatform.zonesAsHeaterCoolers = false;
        accessory = new ZoneControllerAccessory(
          mockPlatform as never,
          mockPlatformAccessory as never,
          mockZone as never,
        );
        await accessory.updateCharacteristics();
        // Just verify no errors
      });

      it('should update characteristics in heater cooler mode', async () => {
        mockPlatform.zonesAsHeaterCoolers = true;
        accessory = new ZoneControllerAccessory(
          mockPlatform as never,
          mockPlatformAccessory as never,
          mockZone as never,
        );
        await accessory.updateCharacteristics();
        // Just verify no errors
      });
    });
  });
});
