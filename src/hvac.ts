import QueApi from './queApi';
import { PowerState, FanMode, ClimateMode, CompressorMode, validApiCommands, ZoneStatus, HvacStatus, CommandResult } from './types';
import { Logger } from 'homebridge';
import { HvacZone } from './hvacZone';

export class HvacUnit {
  readonly name: string;
  type = '';
  serialNo = '';
  apiInterface!: QueApi;

  cloudConnected = false;
  powerState: PowerState = PowerState.UNKNOWN;
  climateMode: ClimateMode = ClimateMode.UNKNOWN;
  fanMode: FanMode = FanMode.UNKNOWN;
  compressorMode: CompressorMode = CompressorMode.UNKNOWN;
  fanRunning = false;
  awayMode = false;
  quietMode = false;
  continuousFanMode = false;
  controlAllZones = false;
  masterCoolingSetTemp = 0;
  masterHeatingSetTemp = 0;
  masterCurrentTemp = 0;
  masterHumidity = 0;
  compressorChasingTemp = 0;
  compressorCurrentTemp = 0;
  zoneData: ZoneStatus[] = [];
  zoneInstances: HvacZone[] = [];

  constructor(name: string,
    private readonly log: Logger,
    private readonly hbUserStoragePath: string,
    readonly zonesFollowMaster = true,
    readonly zonesPushMaster = true,
    readonly zonesAsHeaterCoolers = false) {
    this.name = name;
  }

  async actronQueApi(username: string, password: string, serialNo = '') {
    this.type = 'actronNeo';
    this.apiInterface = new QueApi(username, password, this.name, this.log, this.hbUserStoragePath, serialNo);
    await this.apiInterface.initializer();
    if (this.apiInterface.actronSerial) {
      this.serialNo = this.apiInterface.actronSerial;
    } else {
      throw Error('Failed to locate device serial number. Please check your config file');
    }
    return this.serialNo;
  }

  async getStatus(): Promise<HvacStatus> {
    const status = await this.apiInterface.getStatus();

    if (status.apiError) {
      this.log.warn('Failed to refresh status, Actron Neo Cloud unreachable or returned invalid data');
      return status;
    }

    this.cloudConnected = (status.cloudConnected === undefined) ? this.cloudConnected : status.cloudConnected;
    this.powerState = (status.powerState === undefined) ? this.powerState : status.powerState;
    this.climateMode = (status.climateMode === undefined) ? this.climateMode : status.climateMode;
    this.compressorMode = (status.compressorMode === undefined) ? this.compressorMode : status.compressorMode;
    this.fanMode = (status.fanMode === undefined) ? this.fanMode : status.fanMode;
    this.fanRunning = (status.fanRunning === undefined) ? this.fanRunning : status.fanRunning;
    this.masterCoolingSetTemp = (status.masterCoolingSetTemp === undefined) ? this.masterCoolingSetTemp : status.masterCoolingSetTemp;
    this.masterHeatingSetTemp = (status.masterHeatingSetTemp === undefined) ? this.masterHeatingSetTemp : status.masterHeatingSetTemp;
    this.compressorChasingTemp = (status.compressorChasingTemp === undefined) ? this.compressorChasingTemp : status.compressorChasingTemp;
    this.compressorCurrentTemp = (status.compressorCurrentTemp === undefined) ? this.compressorCurrentTemp : status.compressorCurrentTemp;
    this.awayMode = (status.awayMode === undefined) ? this.awayMode : status.awayMode;
    this.quietMode = (status.quietMode === undefined) ? this.quietMode : status.quietMode;
    this.continuousFanMode = (status.continuousFanMode === undefined) ? this.continuousFanMode : status.continuousFanMode;
    this.controlAllZones = (status.controlAllZones === undefined) ? this.controlAllZones : status.controlAllZones;
    this.masterCurrentTemp = (status.masterCurrentTemp === undefined) ? this.masterCurrentTemp : status.masterCurrentTemp;
    this.masterHumidity = (status.masterCurrentHumidity === undefined) ? this.masterHumidity : status.masterCurrentHumidity;
    this.zoneData = (status.zoneCurrentStatus === undefined) ? this.zoneData : status.zoneCurrentStatus;

    // Update zone instances
    for (const zone of this.zoneData) {
      const targetInstance = this.zoneInstances.find(zoneInstance => zoneInstance.zoneName === zone.zoneName);
      if (targetInstance) {
        targetInstance.pushStatusUpdate(zone);
      } else {
        this.zoneInstances.push(new HvacZone(this.log, this.apiInterface, zone));
      }
    }
    return status;
  }

  async setPowerStateOn(): Promise<PowerState> {
    if (this.powerState === PowerState.UNKNOWN) {
      await this.getStatus();
    }
    if (this.powerState === PowerState.ON) {
      return PowerState.ON;
    } else {
      const response = await this.apiInterface.runCommand(validApiCommands.ON);
      if (response === CommandResult.SUCCESS) {
        this.powerState = PowerState.ON;
      } else if (response === CommandResult.FAILURE) {
        await this.getStatus();
        this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
      } else {
        this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
      }
    }
    return this.powerState;
  }

  async setPowerStateOff(): Promise<PowerState> {
    if (this.powerState === PowerState.UNKNOWN) {
      await this.getStatus();
    }
    if (this.powerState === PowerState.OFF) {
      return PowerState.OFF;
    } else {
      const response = await this.apiInterface.runCommand(validApiCommands.OFF);
      if (response === CommandResult.SUCCESS) {
        this.powerState = PowerState.OFF;
      } else if (response === CommandResult.FAILURE) {
        await this.getStatus();
        this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
      } else {
        this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
      }
    }
    return this.powerState;
  }

  async setHeatTemp(heatTemp: number): Promise<number> {
    const coolTemp = 0;
    const response = await this.apiInterface.runCommand(validApiCommands.HEAT_SET_POINT, coolTemp, heatTemp);
    if (response === CommandResult.SUCCESS) {
      this.masterHeatingSetTemp = heatTemp;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.masterHeatingSetTemp;
  }

  async setCoolTemp(coolTemp: number): Promise<number> {
    const heatTemp = 0;
    const response = await this.apiInterface.runCommand(validApiCommands.COOL_SET_POINT, coolTemp, heatTemp);
    if (response === CommandResult.SUCCESS) {
      this.masterCoolingSetTemp = coolTemp;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.masterCoolingSetTemp;
  }

  async setHeatCoolTemp(coolTemp: number, heatTemp: number): Promise<number[]> {
    const response = await this.apiInterface.runCommand(validApiCommands.HEAT_COOL_SET_POINT, coolTemp, heatTemp);
    if (response === CommandResult.SUCCESS) {
      this.masterCoolingSetTemp = coolTemp;
      this.masterHeatingSetTemp = heatTemp;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return [this.masterCoolingSetTemp, this.masterHeatingSetTemp];
  }

  async setClimateModeAuto(): Promise<ClimateMode> {
    const response = await this.apiInterface.runCommand(validApiCommands.CLIMATE_MODE_AUTO);
    if (response === CommandResult.SUCCESS) {
      this.climateMode = ClimateMode.AUTO;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.climateMode;
  }

  async setClimateModeCool(): Promise<ClimateMode> {
    const response = await this.apiInterface.runCommand(validApiCommands.CLIMATE_MODE_COOL);
    if (response === CommandResult.SUCCESS) {
      this.climateMode = ClimateMode.COOL;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.climateMode;
  }

  async setClimateModeHeat(): Promise<ClimateMode> {
    const response = await this.apiInterface.runCommand(validApiCommands.CLIMATE_MODE_HEAT);
    if (response === CommandResult.SUCCESS) {
      this.climateMode = ClimateMode.HEAT;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.climateMode;
  }

  async setClimateModeFan(): Promise<ClimateMode> {
    const response = await this.apiInterface.runCommand(validApiCommands.CLIMATE_MODE_FAN);
    if (response === CommandResult.SUCCESS) {
      this.climateMode = ClimateMode.FAN;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.climateMode;
  }

  async setFanModeAuto(): Promise<FanMode> {
    const response = await this.apiInterface.runCommand(this.continuousFanMode ? validApiCommands.FAN_MODE_AUTO_CONT : validApiCommands.FAN_MODE_AUTO);
    if (response === CommandResult.SUCCESS) {
      this.fanMode = this.continuousFanMode ? FanMode.AUTO_CONT : FanMode.AUTO;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.fanMode;
  }

  async setFanModeLow(): Promise<FanMode> {
    const response = await this.apiInterface.runCommand(this.continuousFanMode ? validApiCommands.FAN_MODE_LOW_CONT : validApiCommands.FAN_MODE_LOW);
    if (response === CommandResult.SUCCESS) {
      this.fanMode = this.continuousFanMode ? FanMode.LOW_CONT : FanMode.LOW;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.fanMode;
  }

  async setFanModeMedium(): Promise<FanMode> {
    const response = await this.apiInterface.runCommand(this.continuousFanMode ? validApiCommands.FAN_MODE_MEDIUM_CONT : validApiCommands.FAN_MODE_MEDIUM);
    if (response === CommandResult.SUCCESS) {
      this.fanMode = this.continuousFanMode ? FanMode.MEDIUM_CONT : FanMode.MEDIUM;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.fanMode;
  }

  async setFanModeHigh(): Promise<FanMode> {
    const response = await this.apiInterface.runCommand(this.continuousFanMode ? validApiCommands.FAN_MODE_HIGH_CONT : validApiCommands.FAN_MODE_HIGH);
    if (response === CommandResult.SUCCESS) {
      this.fanMode = this.continuousFanMode ? FanMode.HIGH_CONT : FanMode.HIGH;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.fanMode;
  }

  async setAwayModeOn(): Promise<boolean> {
    const response = await this.apiInterface.runCommand(validApiCommands.AWAY_MODE_ON);
    if (response === CommandResult.SUCCESS) {
      this.awayMode = true;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.awayMode;
  }

  async setAwayModeOff(): Promise<boolean> {
    const response = await this.apiInterface.runCommand(validApiCommands.AWAY_MODE_OFF);
    if (response === CommandResult.SUCCESS) {
      this.awayMode = false;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.awayMode;
  }

  async setQuietModeOn(): Promise<boolean> {
    const response = await this.apiInterface.runCommand(validApiCommands.QUIET_MODE_ON);
    if (response === CommandResult.SUCCESS) {
      this.quietMode = true;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.quietMode;
  }

  async setQuietModeOff(): Promise<boolean> {
    const response = await this.apiInterface.runCommand(validApiCommands.QUIET_MODE_OFF);
    if (response === CommandResult.SUCCESS) {
      this.quietMode = false;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.quietMode;
  }

  async setContinuousFanModeOn(): Promise<boolean> {
    let response: CommandResult = CommandResult.FAILURE;
    if (this.fanMode === FanMode.AUTO || this.fanMode === FanMode.AUTO_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_AUTO_CONT);
    } else if (this.fanMode === FanMode.HIGH || this.fanMode === FanMode.HIGH_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_HIGH_CONT);
    } else if (this.fanMode === FanMode.MEDIUM || this.fanMode === FanMode.MEDIUM_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_MEDIUM_CONT);
    } else if (this.fanMode === FanMode.LOW || this.fanMode === FanMode.LOW_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_LOW_CONT);
    }
    if (response === CommandResult.SUCCESS) {
      this.continuousFanMode = true;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
      this.log.error(response);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.continuousFanMode;
  }

  async setContinuousFanModeOff(): Promise<boolean> {
    let response: CommandResult = CommandResult.FAILURE;
    if (this.fanMode === FanMode.AUTO || this.fanMode === FanMode.AUTO_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_AUTO);
    } else if (this.fanMode === FanMode.HIGH || this.fanMode === FanMode.HIGH_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_HIGH);
    } else if (this.fanMode === FanMode.MEDIUM || this.fanMode === FanMode.MEDIUM_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_MEDIUM);
    } else if (this.fanMode === FanMode.LOW || this.fanMode === FanMode.LOW_CONT) {
      response = await this.apiInterface.runCommand(validApiCommands.FAN_MODE_LOW);
    }
    if (response === CommandResult.SUCCESS) {
      this.continuousFanMode = false;
    } else if (response === CommandResult.FAILURE) {
      await this.getStatus();
      this.log.error(`Failed to set master ${this.name}, refreshing master state from API`);
    } else {
      this.log.warn('Failed to send command, Actron Neo Cloud unreachable');
    }
    return this.continuousFanMode;
  }
}