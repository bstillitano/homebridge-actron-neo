import { HvacUnit } from './hvac';
import { CommandResult, PowerState, ClimateMode, FanMode, CompressorMode } from './types';
import { mockLogger } from './__mocks__/mockHomebridge';
import { createMockHvacStatus, createMockZoneStatus } from './__mocks__/mockQueApi';

// Mock the QueApi module
jest.mock('./queApi', () => {
  return jest.fn().mockImplementation(() => ({
    initializer: jest.fn().mockResolvedValue(undefined),
    actronSerial: 'TEST123456',
    getStatus: jest.fn(),
    runCommand: jest.fn(),
  }));
});

describe('HvacUnit', () => {
  let hvac: HvacUnit;
  let mockApiInterface: {
    initializer: jest.Mock;
    actronSerial: string;
    getStatus: jest.Mock;
    runCommand: jest.Mock;
  };

  beforeEach(() => {
    hvac = new HvacUnit('Test AC', mockLogger, '/test/path', true, true, false);

    mockApiInterface = {
      initializer: jest.fn().mockResolvedValue(undefined),
      actronSerial: 'TEST123456',
      getStatus: jest.fn().mockResolvedValue(createMockHvacStatus()),
      runCommand: jest.fn().mockResolvedValue(CommandResult.SUCCESS),
    };

    // Inject mock API interface
    hvac.apiInterface = mockApiInterface as never;
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(hvac.name).toBe('Test AC');
    });

    it('should initialize with default state values', () => {
      expect(hvac.powerState).toBe(PowerState.UNKNOWN);
      expect(hvac.climateMode).toBe(ClimateMode.UNKNOWN);
      expect(hvac.fanMode).toBe(FanMode.UNKNOWN);
      expect(hvac.cloudConnected).toBe(false);
    });

    it('should store zone configuration options', () => {
      expect(hvac.zonesFollowMaster).toBe(true);
      expect(hvac.zonesPushMaster).toBe(true);
      expect(hvac.zonesAsHeaterCoolers).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should update state from API response', async () => {
      const mockStatus = createMockHvacStatus({
        cloudConnected: true,
        powerState: PowerState.ON,
        climateMode: ClimateMode.COOL,
        fanMode: FanMode.AUTO,
        masterCurrentTemp: 23.5,
        masterCoolingSetTemp: 24,
      });
      mockApiInterface.getStatus.mockResolvedValue(mockStatus);

      await hvac.getStatus();

      expect(hvac.cloudConnected).toBe(true);
      expect(hvac.powerState).toBe(PowerState.ON);
      expect(hvac.climateMode).toBe(ClimateMode.COOL);
      expect(hvac.fanMode).toBe(FanMode.AUTO);
      expect(hvac.masterCurrentTemp).toBe(23.5);
      expect(hvac.masterCoolingSetTemp).toBe(24);
    });

    it('should handle API error', async () => {
      mockApiInterface.getStatus.mockResolvedValue({
        apiError: true,
        zoneCurrentStatus: [],
      });

      const result = await hvac.getStatus();

      expect(result.apiError).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should create zone instances from status', async () => {
      const mockStatus = createMockHvacStatus({
        zoneCurrentStatus: [
          createMockZoneStatus({ zoneName: 'Zone 1' }),
          createMockZoneStatus({ zoneName: 'Zone 2' }),
        ],
      });
      mockApiInterface.getStatus.mockResolvedValue(mockStatus);

      await hvac.getStatus();

      expect(hvac.zoneInstances).toHaveLength(2);
      expect(hvac.zoneInstances[0].zoneName).toBe('Zone 1');
      expect(hvac.zoneInstances[1].zoneName).toBe('Zone 2');
    });

    it('should update existing zone instances', async () => {
      // First call to create zones
      const initialStatus = createMockHvacStatus({
        zoneCurrentStatus: [createMockZoneStatus({ zoneName: 'Zone 1', currentTemp: 22 })],
      });
      mockApiInterface.getStatus.mockResolvedValue(initialStatus);
      await hvac.getStatus();

      // Second call to update zones
      const updatedStatus = createMockHvacStatus({
        zoneCurrentStatus: [createMockZoneStatus({ zoneName: 'Zone 1', currentTemp: 25 })],
      });
      mockApiInterface.getStatus.mockResolvedValue(updatedStatus);
      await hvac.getStatus();

      expect(hvac.zoneInstances).toHaveLength(1);
      expect(hvac.zoneInstances[0].currentTemp).toBe(25);
    });
  });

  describe('setPowerStateOn', () => {
    it('should return ON if already on', async () => {
      hvac.powerState = PowerState.ON;

      const result = await hvac.setPowerStateOn();

      expect(result).toBe(PowerState.ON);
      expect(mockApiInterface.runCommand).not.toHaveBeenCalled();
    });

    it('should send command and update state on success', async () => {
      hvac.powerState = PowerState.OFF;
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await hvac.setPowerStateOn();

      expect(result).toBe(PowerState.ON);
      expect(hvac.powerState).toBe(PowerState.ON);
    });

    it('should refresh status on failure', async () => {
      hvac.powerState = PowerState.OFF;
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.FAILURE);
      mockApiInterface.getStatus.mockResolvedValue(createMockHvacStatus({ powerState: PowerState.OFF }));

      await hvac.setPowerStateOn();

      expect(mockApiInterface.getStatus).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should fetch status if power state is unknown', async () => {
      hvac.powerState = PowerState.UNKNOWN;
      mockApiInterface.getStatus.mockResolvedValue(createMockHvacStatus({ powerState: PowerState.ON }));

      const result = await hvac.setPowerStateOn();

      expect(mockApiInterface.getStatus).toHaveBeenCalled();
      expect(result).toBe(PowerState.ON);
    });
  });

  describe('setPowerStateOff', () => {
    it('should return OFF if already off', async () => {
      hvac.powerState = PowerState.OFF;

      const result = await hvac.setPowerStateOff();

      expect(result).toBe(PowerState.OFF);
      expect(mockApiInterface.runCommand).not.toHaveBeenCalled();
    });

    it('should send command and update state on success', async () => {
      hvac.powerState = PowerState.ON;
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await hvac.setPowerStateOff();

      expect(result).toBe(PowerState.OFF);
      expect(hvac.powerState).toBe(PowerState.OFF);
    });
  });

  describe('Climate mode setters', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setClimateModeAuto should set AUTO mode', async () => {
      const result = await hvac.setClimateModeAuto();
      expect(result).toBe(ClimateMode.AUTO);
      expect(hvac.climateMode).toBe(ClimateMode.AUTO);
    });

    it('setClimateModeCool should set COOL mode', async () => {
      const result = await hvac.setClimateModeCool();
      expect(result).toBe(ClimateMode.COOL);
      expect(hvac.climateMode).toBe(ClimateMode.COOL);
    });

    it('setClimateModeHeat should set HEAT mode', async () => {
      const result = await hvac.setClimateModeHeat();
      expect(result).toBe(ClimateMode.HEAT);
      expect(hvac.climateMode).toBe(ClimateMode.HEAT);
    });

    it('setClimateModeFan should set FAN mode', async () => {
      const result = await hvac.setClimateModeFan();
      expect(result).toBe(ClimateMode.FAN);
      expect(hvac.climateMode).toBe(ClimateMode.FAN);
    });
  });

  describe('Fan mode setters', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setFanModeAuto should set AUTO fan mode', async () => {
      const result = await hvac.setFanModeAuto();
      expect(result).toBe(FanMode.AUTO);
    });

    it('setFanModeLow should set LOW fan mode', async () => {
      const result = await hvac.setFanModeLow();
      expect(result).toBe(FanMode.LOW);
    });

    it('setFanModeMedium should set MEDIUM fan mode', async () => {
      const result = await hvac.setFanModeMedium();
      expect(result).toBe(FanMode.MEDIUM);
    });

    it('setFanModeHigh should set HIGH fan mode', async () => {
      const result = await hvac.setFanModeHigh();
      expect(result).toBe(FanMode.HIGH);
    });
  });

  describe('Temperature setters', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setCoolTemp should set cooling temperature', async () => {
      const result = await hvac.setCoolTemp(24);
      expect(result).toBe(24);
      expect(hvac.masterCoolingSetTemp).toBe(24);
    });

    it('setHeatTemp should set heating temperature', async () => {
      const result = await hvac.setHeatTemp(20);
      expect(result).toBe(20);
      expect(hvac.masterHeatingSetTemp).toBe(20);
    });
  });

  describe('Away mode', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setAwayModeOn should enable away mode', async () => {
      const result = await hvac.setAwayModeOn();
      expect(result).toBe(true);
      expect(hvac.awayMode).toBe(true);
    });

    it('setAwayModeOff should disable away mode', async () => {
      hvac.awayMode = true;
      const result = await hvac.setAwayModeOff();
      expect(result).toBe(false);
      expect(hvac.awayMode).toBe(false);
    });
  });

  describe('Quiet mode', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setQuietModeOn should enable quiet mode', async () => {
      const result = await hvac.setQuietModeOn();
      expect(result).toBe(true);
      expect(hvac.quietMode).toBe(true);
    });

    it('setQuietModeOff should disable quiet mode', async () => {
      hvac.quietMode = true;
      const result = await hvac.setQuietModeOff();
      expect(result).toBe(false);
      expect(hvac.quietMode).toBe(false);
    });
  });

  describe('Continuous fan mode', () => {
    beforeEach(() => {
      mockApiInterface.runCommand.mockResolvedValue(CommandResult.SUCCESS);
    });

    it('setContinuousFanModeOn should enable continuous fan with correct command', async () => {
      hvac.fanMode = FanMode.AUTO;
      const result = await hvac.setContinuousFanModeOn();
      expect(result).toBe(true);
      expect(hvac.continuousFanMode).toBe(true);
    });

    it('setContinuousFanModeOff should disable continuous fan', async () => {
      hvac.fanMode = FanMode.AUTO_CONT;
      hvac.continuousFanMode = true;
      const result = await hvac.setContinuousFanModeOff();
      expect(result).toBe(false);
      expect(hvac.continuousFanMode).toBe(false);
    });
  });
});
