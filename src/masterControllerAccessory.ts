import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ClimateMode, CompressorMode, FanMode, PowerState } from './types';
import { ActronQuePlatform } from './platform';

export class MasterControllerAccessory {
  private hvacService: Service;
  private humidityService: Service;

  constructor(
    private readonly platform: ActronQuePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Actron')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Master Controller')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.hvacInstance.serialNo);

    this.hvacService = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);

    this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
      || this.accessory.addService(this.platform.Service.HumiditySensor);

    this.hvacService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getHumidity.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setPowerState.bind(this))
      .onGet(this.getPowerState.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentCompressorMode.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetClimateMode.bind(this))
      .onSet(this.setTargetClimateMode.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.platform.minHeatingTemp,
        maxValue: this.platform.maxHeatingTemp,
        minStep: 0.5,
      })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.platform.minCoolingTemp,
        maxValue: this.platform.maxCoolingTemp,
        minStep: 0.5,
      })
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(this.setFanMode.bind(this))
      .onGet(this.getFanMode.bind(this));

    setInterval(() => this.hardUpdateDeviceCharacteristics(), this.platform.hardRefreshInterval);
    setInterval(() => this.softUpdateDeviceCharacteristics(), this.platform.softRefreshInterval);
  }

  async hardUpdateDeviceCharacteristics() {
    const currentStatus = await this.platform.hvacInstance.getStatus();
    this.softUpdateDeviceCharacteristics();
    if (currentStatus.apiError) {
      this.platform.log.info('Actron Neo cloud error, refreshing HomeKit accessory state using cached data');
    } else if (!currentStatus.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection.\n' +
        'Refreshing HomeKit accessory state using cached data');
    } else {
      this.platform.log.debug('Successfully refreshed HomeKit accessory state from Neo cloud\n');
    }
  }

  async softUpdateDeviceCharacteristics() {
    this.hvacService.updateCharacteristic(this.platform.Characteristic.Active, this.getPowerState());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentCompressorMode());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetClimateMode());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.getFanMode());
    this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getHumidity());
  }

  checkHvacComms() {
    if (!this.platform.hvacInstance.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getHumidity(): CharacteristicValue {
    const currentHumidity = this.platform.hvacInstance.masterHumidity;
    return currentHumidity;
  }

  async setPowerState(value: CharacteristicValue) {
    this.checkHvacComms();
    switch (value) {
      case 0:
        await this.platform.hvacInstance.setPowerStateOff();
        break;
      case 1:
        await this.platform.hvacInstance.setPowerStateOn();
        break;
    }
    this.platform.log.debug('Set Master Power State -> ', value);
  }

  getPowerState(): CharacteristicValue {
    const powerState = (this.platform.hvacInstance.powerState === PowerState.ON) ? 1 : 0;
    return powerState;
  }

  getCurrentCompressorMode(): CharacteristicValue {
    let currentMode: number;
    const compressorMode = this.platform.hvacInstance.compressorMode;
    switch (compressorMode) {
      case CompressorMode.OFF:
        currentMode = 0;
        break;
      case CompressorMode.HEAT:
        currentMode = 2;
        break;
      case CompressorMode.COOL:
        currentMode = 3;
        break;
      default:
        currentMode = 0;
        this.platform.log.debug('Failed To Get Master Valid Compressor Mode -> ', compressorMode);
    }
    if (!this.platform.hvacInstance.fanRunning) {
      currentMode = 1;
    }
    return currentMode;
  }

  async setTargetClimateMode(value: CharacteristicValue) {
    this.checkHvacComms();
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        await this.platform.hvacInstance.setClimateModeAuto();
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        await this.platform.hvacInstance.setClimateModeHeat();
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        await this.platform.hvacInstance.setClimateModeCool();
        break;
      default:
        this.platform.log.debug('Failed To Set Master Climate Mode -> ', value);
    }
    this.platform.log.debug('Set Master Climate Mode -> ', value);
  }

  getTargetClimateMode(): CharacteristicValue {
    let currentMode: number;
    const climateMode = this.platform.hvacInstance.climateMode;
    switch (climateMode) {
      case ClimateMode.AUTO:
        currentMode = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        break;
      case ClimateMode.HEAT:
        currentMode = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        break;
      case ClimateMode.COOL:
        currentMode = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
        break;
      default:
        currentMode = 0;
        this.platform.log.debug('Failed To Get Master Target Climate Mode -> ', climateMode);
    }
    return currentMode;
  }

  getCurrentTemperature(): CharacteristicValue {
    const currentTemp = this.platform.hvacInstance.masterCurrentTemp;
    // Convert the temperature to the correct scale (assuming it's in Celsius * 100)
    return Math.min(Math.max(currentTemp / 100, 0), 100);
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    await this.platform.hvacInstance.setHeatTemp(value as number);
    await this.platform.hvacInstance.getStatus();
    this.platform.log.debug('Set Master Target Heating Temperature -> ', value);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.platform.hvacInstance.masterHeatingSetTemp;
    return targetTemp;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    await this.platform.hvacInstance.setCoolTemp(value as number);
    await this.platform.hvacInstance.getStatus();
    this.platform.log.debug('Set Master Target Cooling Temperature -> ', value);
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.platform.hvacInstance.masterCoolingSetTemp;
    return targetTemp;
  }

  async setFanMode(value: CharacteristicValue) {
    this.checkHvacComms();
    switch (true) {
      case (value <= 30):
        await this.platform.hvacInstance.setFanModeLow();
        break;
      case (value <= 60):
        await this.platform.hvacInstance.setFanModeMedium();
        break;
      case (value <= 90):
        await this.platform.hvacInstance.setFanModeHigh();
        break;
      case (value <= 100):
        await this.platform.hvacInstance.setFanModeAuto();
        break;
    }
    this.platform.log.debug('Set Master Fan Mode 91-100:Auto, 1-30:Low, 31-60:Medium, 61-90:High -> ', value);
  }

  getFanMode(): CharacteristicValue {
    let currentMode: number;
    const fanMode = this.platform.hvacInstance.fanMode;
    switch (fanMode) {
      case FanMode.AUTO || FanMode.AUTO_CONT:
        currentMode = 100;
        break;
      case FanMode.LOW || FanMode.LOW_CONT:
        currentMode = 29;
        break;
      case FanMode.MEDIUM || FanMode.MEDIUM_CONT:
        currentMode = 59;
        break;
      case FanMode.HIGH || FanMode.HIGH_CONT:
        currentMode = 89;
        break;
      default:
        currentMode = 0;
        this.platform.log.debug('Failed To Get Master Current Fan Mode -> ', fanMode);
    }
    return currentMode;
  }
}