import { queApiCommands } from './queCommands';

describe('queApiCommands', () => {
  describe('Power commands', () => {
    it('ON should set isOn to true', () => {
      const result = queApiCommands.ON();
      expect(result.command).toEqual({
        'UserAirconSettings.isOn': true,
        'type': 'set-settings',
      });
    });

    it('OFF should set isOn to false', () => {
      const result = queApiCommands.OFF();
      expect(result.command).toEqual({
        'UserAirconSettings.isOn': false,
        'type': 'set-settings',
      });
    });
  });

  describe('Climate mode commands', () => {
    it('CLIMATE_MODE_AUTO should set Mode to AUTO', () => {
      const result = queApiCommands.CLIMATE_MODE_AUTO();
      expect(result.command['UserAirconSettings.Mode']).toBe('AUTO');
    });

    it('CLIMATE_MODE_COOL should set Mode to COOL', () => {
      const result = queApiCommands.CLIMATE_MODE_COOL();
      expect(result.command['UserAirconSettings.Mode']).toBe('COOL');
    });

    it('CLIMATE_MODE_HEAT should set Mode to HEAT', () => {
      const result = queApiCommands.CLIMATE_MODE_HEAT();
      expect(result.command['UserAirconSettings.Mode']).toBe('HEAT');
    });

    it('CLIMATE_MODE_FAN should set Mode to FAN', () => {
      const result = queApiCommands.CLIMATE_MODE_FAN();
      expect(result.command['UserAirconSettings.Mode']).toBe('FAN');
    });
  });

  describe('Fan mode commands', () => {
    it('FAN_MODE_AUTO should set FanMode to AUTO', () => {
      const result = queApiCommands.FAN_MODE_AUTO();
      expect(result.command['UserAirconSettings.FanMode']).toBe('AUTO');
    });

    it('FAN_MODE_AUTO_CONT should set FanMode to AUTO+CONT', () => {
      const result = queApiCommands.FAN_MODE_AUTO_CONT();
      expect(result.command['UserAirconSettings.FanMode']).toBe('AUTO+CONT');
    });

    it('FAN_MODE_LOW should set FanMode to LOW', () => {
      const result = queApiCommands.FAN_MODE_LOW();
      expect(result.command['UserAirconSettings.FanMode']).toBe('LOW');
    });

    it('FAN_MODE_LOW_CONT should set FanMode to LOW+CONT', () => {
      const result = queApiCommands.FAN_MODE_LOW_CONT();
      expect(result.command['UserAirconSettings.FanMode']).toBe('LOW+CONT');
    });

    it('FAN_MODE_MEDIUM should set FanMode to MED', () => {
      const result = queApiCommands.FAN_MODE_MEDIUM();
      expect(result.command['UserAirconSettings.FanMode']).toBe('MED');
    });

    it('FAN_MODE_MEDIUM_CONT should set FanMode to MED+CONT', () => {
      const result = queApiCommands.FAN_MODE_MEDIUM_CONT();
      expect(result.command['UserAirconSettings.FanMode']).toBe('MED+CONT');
    });

    it('FAN_MODE_HIGH should set FanMode to HIGH', () => {
      const result = queApiCommands.FAN_MODE_HIGH();
      expect(result.command['UserAirconSettings.FanMode']).toBe('HIGH');
    });

    it('FAN_MODE_HIGH_CONT should set FanMode to HIGH+CONT', () => {
      const result = queApiCommands.FAN_MODE_HIGH_CONT();
      expect(result.command['UserAirconSettings.FanMode']).toBe('HIGH+CONT');
    });
  });

  describe('Temperature setpoint commands', () => {
    it('COOL_SET_POINT should set cooling temperature', () => {
      const result = queApiCommands.COOL_SET_POINT(24, 20);
      expect(result.command['UserAirconSettings.TemperatureSetpoint_Cool_oC']).toBe(24);
    });

    it('HEAT_SET_POINT should set heating temperature', () => {
      const result = queApiCommands.HEAT_SET_POINT(24, 20);
      expect(result.command['UserAirconSettings.TemperatureSetpoint_Heat_oC']).toBe(20);
    });

    it('HEAT_COOL_SET_POINT should set both temperatures', () => {
      const result = queApiCommands.HEAT_COOL_SET_POINT(24, 20);
      expect(result.command['UserAirconSettings.TemperatureSetpoint_Cool_oC']).toBe(24);
      expect(result.command['UserAirconSettings.TemperatureSetpoint_Heat_oC']).toBe(20);
    });
  });

  describe('Control all zones commands', () => {
    it('CONTROL_ALL_ZONES_ON should set ControlAllZones to true', () => {
      const result = queApiCommands.CONTROL_ALL_ZONES_ON();
      expect(result.command['MasterInfo.ControlAllZones']).toBe(true);
    });

    it('CONTROL_ALL_ZONES_OFF should set ControlAllZones to false', () => {
      const result = queApiCommands.CONTROL_ALL_ZONES_OFF();
      expect(result.command['MasterInfo.ControlAllZones']).toBe(false);
    });
  });

  describe('Away mode commands', () => {
    it('AWAY_MODE_ON should set AwayMode to true', () => {
      const result = queApiCommands.AWAY_MODE_ON();
      expect(result.command['UserAirconSettings.AwayMode']).toBe(true);
    });

    it('AWAY_MODE_OFF should set AwayMode to false', () => {
      const result = queApiCommands.AWAY_MODE_OFF();
      expect(result.command['UserAirconSettings.AwayMode']).toBe(false);
    });
  });

  describe('Quiet mode commands', () => {
    it('QUIET_MODE_ON should set QuietMode to true', () => {
      const result = queApiCommands.QUIET_MODE_ON();
      expect(result.command['UserAirconSettings.QuietMode']).toBe(true);
    });

    it('QUIET_MODE_OFF should set QuietMode to false', () => {
      const result = queApiCommands.QUIET_MODE_OFF();
      expect(result.command['UserAirconSettings.QuietMode']).toBe(false);
    });
  });

  describe('Zone commands', () => {
    it('ZONE_ENABLE should enable the specified zone', () => {
      const currentZones = [true, false, false];
      const result = queApiCommands.ZONE_ENABLE(0, 0, 1, currentZones);
      expect(result.command['UserAirconSettings.EnabledZones']).toEqual([true, true, false]);
    });

    it('ZONE_ENABLE should not mutate the original array', () => {
      const currentZones = [true, false, false];
      queApiCommands.ZONE_ENABLE(0, 0, 1, currentZones);
      expect(currentZones).toEqual([true, false, false]);
    });

    it('ZONE_DISABLE should disable the specified zone', () => {
      const currentZones = [true, true, true];
      const result = queApiCommands.ZONE_DISABLE(0, 0, 1, currentZones);
      expect(result.command['UserAirconSettings.EnabledZones']).toEqual([true, false, true]);
    });

    it('ZONE_DISABLE should not mutate the original array', () => {
      const currentZones = [true, true, true];
      queApiCommands.ZONE_DISABLE(0, 0, 1, currentZones);
      expect(currentZones).toEqual([true, true, true]);
    });

    it('ZONE_COOL_SET_POINT should set zone cooling temperature', () => {
      const result = queApiCommands.ZONE_COOL_SET_POINT(24, 0, 2);
      expect(result.command['RemoteZoneInfo[2].TemperatureSetpoint_Cool_oC']).toBe(24);
    });

    it('ZONE_HEAT_SET_POINT should set zone heating temperature', () => {
      const result = queApiCommands.ZONE_HEAT_SET_POINT(0, 20, 1);
      expect(result.command['RemoteZoneInfo[1].TemperatureSetpoint_Heat_oC']).toBe(20);
    });
  });

  describe('Command structure', () => {
    it('all commands should have type set-settings', () => {
      const commands = [
        queApiCommands.ON(),
        queApiCommands.OFF(),
        queApiCommands.CLIMATE_MODE_AUTO(),
        queApiCommands.FAN_MODE_AUTO(),
        queApiCommands.COOL_SET_POINT(24, 20),
        queApiCommands.AWAY_MODE_ON(),
        queApiCommands.QUIET_MODE_ON(),
        queApiCommands.ZONE_ENABLE(0, 0, 0, [false]),
      ];

      commands.forEach(cmd => {
        expect(cmd.command.type).toBe('set-settings');
      });
    });
  });
});
