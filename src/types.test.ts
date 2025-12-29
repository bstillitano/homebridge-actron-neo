import {
  CommandResult,
  PowerState,
  ClimateMode,
  CompressorMode,
  FanMode,
  validApiCommands,
} from './types';

describe('Enums', () => {
  describe('CommandResult', () => {
    it('should have correct values', () => {
      expect(CommandResult.SUCCESS).toBe('SUCCESS');
      expect(CommandResult.FAILURE).toBe('FAILURE');
      expect(CommandResult.API_ERROR).toBe('API_ERROR');
    });

    it('should have exactly 3 values', () => {
      const values = Object.values(CommandResult);
      expect(values).toHaveLength(3);
    });
  });

  describe('PowerState', () => {
    it('should have correct values', () => {
      expect(PowerState.ON).toBe('ON');
      expect(PowerState.OFF).toBe('OFF');
      expect(PowerState.UNKNOWN).toBe('UNKNOWN');
      expect(PowerState.NA).toBe('NA');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(PowerState);
      expect(values).toHaveLength(4);
    });
  });

  describe('ClimateMode', () => {
    it('should have correct values', () => {
      expect(ClimateMode.AUTO).toBe('AUTO');
      expect(ClimateMode.COOL).toBe('COOL');
      expect(ClimateMode.HEAT).toBe('HEAT');
      expect(ClimateMode.FAN).toBe('FAN');
      expect(ClimateMode.UNKNOWN).toBe('UNKNOWN');
    });

    it('should have exactly 5 values', () => {
      const values = Object.values(ClimateMode);
      expect(values).toHaveLength(5);
    });
  });

  describe('CompressorMode', () => {
    it('should have correct values', () => {
      expect(CompressorMode.COOL).toBe('COOL');
      expect(CompressorMode.HEAT).toBe('HEAT');
      expect(CompressorMode.OFF).toBe('OFF');
      expect(CompressorMode.UNKNOWN).toBe('UNKNOWN');
    });

    it('should have exactly 4 values', () => {
      const values = Object.values(CompressorMode);
      expect(values).toHaveLength(4);
    });
  });

  describe('FanMode', () => {
    it('should have correct base values', () => {
      expect(FanMode.AUTO).toBe('AUTO');
      expect(FanMode.LOW).toBe('LOW');
      expect(FanMode.MEDIUM).toBe('MED');
      expect(FanMode.HIGH).toBe('HIGH');
      expect(FanMode.UNKNOWN).toBe('UNKNOWN');
    });

    it('should have correct continuous fan values', () => {
      expect(FanMode.AUTO_CONT).toBe('AUTO+CONT');
      expect(FanMode.LOW_CONT).toBe('LOW+CONT');
      expect(FanMode.MEDIUM_CONT).toBe('MED+CONT');
      expect(FanMode.HIGH_CONT).toBe('HIGH+CONT');
    });

    it('should have exactly 9 values', () => {
      const values = Object.values(FanMode);
      expect(values).toHaveLength(9);
    });
  });

  describe('validApiCommands', () => {
    it('should have power commands', () => {
      expect(validApiCommands.ON).toBe('ON');
      expect(validApiCommands.OFF).toBe('OFF');
    });

    it('should have climate mode commands', () => {
      expect(validApiCommands.CLIMATE_MODE_AUTO).toBe('CLIMATE_MODE_AUTO');
      expect(validApiCommands.CLIMATE_MODE_COOL).toBe('CLIMATE_MODE_COOL');
      expect(validApiCommands.CLIMATE_MODE_HEAT).toBe('CLIMATE_MODE_HEAT');
      expect(validApiCommands.CLIMATE_MODE_FAN).toBe('CLIMATE_MODE_FAN');
    });

    it('should have fan mode commands', () => {
      expect(validApiCommands.FAN_MODE_AUTO).toBe('FAN_MODE_AUTO');
      expect(validApiCommands.FAN_MODE_LOW).toBe('FAN_MODE_LOW');
      expect(validApiCommands.FAN_MODE_MEDIUM).toBe('FAN_MODE_MEDIUM');
      expect(validApiCommands.FAN_MODE_HIGH).toBe('FAN_MODE_HIGH');
    });

    it('should have continuous fan mode commands', () => {
      expect(validApiCommands.FAN_MODE_AUTO_CONT).toBe('FAN_MODE_AUTO_CONT');
      expect(validApiCommands.FAN_MODE_LOW_CONT).toBe('FAN_MODE_LOW_CONT');
      expect(validApiCommands.FAN_MODE_MEDIUM_CONT).toBe('FAN_MODE_MEDIUM_CONT');
      expect(validApiCommands.FAN_MODE_HIGH_CONT).toBe('FAN_MODE_HIGH_CONT');
    });

    it('should have temperature setpoint commands', () => {
      expect(validApiCommands.COOL_SET_POINT).toBe('COOL_SET_POINT');
      expect(validApiCommands.HEAT_SET_POINT).toBe('HEAT_SET_POINT');
      expect(validApiCommands.HEAT_COOL_SET_POINT).toBe('HEAT_COOL_SET_POINT');
    });

    it('should have away and quiet mode commands', () => {
      expect(validApiCommands.AWAY_MODE_ON).toBe('AWAY_MODE_ON');
      expect(validApiCommands.AWAY_MODE_OFF).toBe('AWAY_MODE_OFF');
      expect(validApiCommands.QUIET_MODE_ON).toBe('QUIET_MODE_ON');
      expect(validApiCommands.QUIET_MODE_OFF).toBe('QUIET_MODE_OFF');
    });

    it('should have zone control commands', () => {
      expect(validApiCommands.CONTROL_ALL_ZONES_ON).toBe('CONTROL_ALL_ZONES_ON');
      expect(validApiCommands.CONTROL_ALL_ZONES_OFF).toBe('CONTROL_ALL_ZONES_OFF');
      expect(validApiCommands.ZONE_ENABLE).toBe('ZONE_ENABLE');
      expect(validApiCommands.ZONE_DISABLE).toBe('ZONE_DISABLE');
      expect(validApiCommands.ZONE_COOL_SET_POINT).toBe('ZONE_COOL_SET_POINT');
      expect(validApiCommands.ZONE_HEAT_SET_POINT).toBe('ZONE_HEAT_SET_POINT');
    });

    it('should have exactly 27 commands', () => {
      const values = Object.values(validApiCommands);
      expect(values).toHaveLength(27);
    });
  });
});
