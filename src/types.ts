import { HvacUnit } from './hvac';
import { HvacSetting } from './hvacSetting';
import { HvacZone } from './hvacZone';

export enum CommandResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  API_ERROR = 'API_ERROR',
}

export enum PowerState {
  ON = 'ON',
  OFF = 'OFF',
  UNKNOWN = 'UNKNOWN',
  NA = 'NA',
}

export enum ClimateMode {
  AUTO = 'AUTO',
  COOL = 'COOL',
  HEAT = 'HEAT',
  FAN = 'FAN',
  UNKNOWN = 'UNKNOWN',
}

export enum CompressorMode {
  COOL = 'COOL',
  HEAT = 'HEAT',
  OFF = 'OFF',
  UNKNOWN = 'UNKNOWN',
}

export enum FanMode {
  AUTO = 'AUTO',
  LOW = 'LOW',
  MEDIUM = 'MED',
  HIGH = 'HIGH',
  AUTO_CONT = 'AUTO+CONT',
  LOW_CONT = 'LOW+CONT',
  MEDIUM_CONT = 'MED+CONT',
  HIGH_CONT = 'HIGH+CONT',
  UNKNOWN = 'UNKNOWN',
}

export enum validApiCommands {
  ON = 'ON',
  OFF = 'OFF',
  CLIMATE_MODE_AUTO = 'CLIMATE_MODE_AUTO',
  CLIMATE_MODE_COOL = 'CLIMATE_MODE_COOL',
  CLIMATE_MODE_FAN = 'CLIMATE_MODE_FAN',
  CLIMATE_MODE_HEAT = 'CLIMATE_MODE_HEAT',
  FAN_MODE_AUTO = 'FAN_MODE_AUTO',
  FAN_MODE_AUTO_CONT = 'FAN_MODE_AUTO_CONT',
  FAN_MODE_LOW = 'FAN_MODE_LOW',
  FAN_MODE_LOW_CONT = 'FAN_MODE_LOW_CONT',
  FAN_MODE_MEDIUM = 'FAN_MODE_MEDIUM',
  FAN_MODE_MEDIUM_CONT = 'FAN_MODE_MEDIUM_CONT',
  FAN_MODE_HIGH = 'FAN_MODE_HIGH',
  FAN_MODE_HIGH_CONT = 'FAN_MODE_HIGH_CONT',
  COOL_SET_POINT = 'COOL_SET_POINT',
  HEAT_SET_POINT = 'HEAT_SET_POINT',
  HEAT_COOL_SET_POINT = 'HEAT_COOL_SET_POINT',
  AWAY_MODE_ON = 'AWAY_MODE_ON',
  AWAY_MODE_OFF = 'AWAY_MODE_OFF',
  QUIET_MODE_ON = 'QUIET_MODE_ON',
  QUIET_MODE_OFF = 'QUIET_MODE_OFF',
  CONTROL_ALL_ZONES_ON = 'CONTROL_ALL_ZONES_ON',
  CONTROL_ALL_ZONES_OFF = 'CONTROL_ALL_ZONES_OFF',
  ZONE_ENABLE = 'ZONE_ENABLE',
  ZONE_DISABLE = 'ZONE_DISABLE',
  ZONE_COOL_SET_POINT = 'ZONE_COOL_SET_POINT',
  ZONE_HEAT_SET_POINT = 'ZONE_HEAT_SET_POINT',
}

export interface DiscoveredDevices {
  type: string;
  uniqueId: string;
  displayName: string;
  instance: HvacZone | HvacUnit | HvacSetting;
}

export interface apiToken {
  expires: number;
  token: string;
}

export interface tokenCollection {
  refreshToken: apiToken;
  bearerToken: apiToken;
}

export interface ApiAccessError {
  apiAccessError: Error;
}

export interface ZoneStatus {
  zoneName: string;
  zoneIndex: number;
  sensorId: string;
  zoneEnabled: boolean;
  currentTemp: number;
  currentHumidity: number | 'notSupported';
  maxHeatSetPoint: number;
  minHeatSetPoint: number;
  maxCoolSetPoint: number;
  minCoolSetPoint: number;
  currentHeatingSetTemp: number;
  currentCoolingSetTemp: number;
  zoneSensorBattery: number;
}

export interface HvacStatus {
  apiError: boolean;
  cloudConnected?: boolean;
  powerState?: PowerState;
  climateMode?: ClimateMode;
  compressorMode?: CompressorMode;
  fanMode?: FanMode;
  fanRunning?: boolean;
  awayMode?: boolean;
  quietMode?: boolean;
  continuousFanMode?: boolean;
  controlAllZones?: boolean;
  masterCoolingSetTemp?: number;
  masterHeatingSetTemp?: number;
  masterCurrentTemp?: number;
  masterCurrentHumidity?: number;
  compressorChasingTemp?: number;
  compressorCurrentTemp?: number;
  zoneCurrentStatus: ZoneStatus[];
}