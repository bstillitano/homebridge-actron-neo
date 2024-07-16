import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ClimateMode, CompressorMode } from './types';
import { ActronQuePlatform } from './platform';
import { HvacZone } from './hvacZone';

export class ZoneControllerAccessory {
  private hvacService: Service;
  private humidityService: Service | null;
  private batteryService: Service;

  constructor(
    private readonly platform: ActronQuePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly zone: HvacZone,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Actron')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Zone Controller')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.zone.sensorId);

    if (this.platform.zonesAsHeaterCoolers) {
      this.hvacService = this.accessory.getService(this.platform.Service.HeaterCooler)
        || this.accessory.addService(this.platform.Service.HeaterCooler);
    } else {
      this.hvacService = this.accessory.getService(this.platform.Service.Lightbulb)
        || this.accessory.addService(this.platform.Service.Lightbulb);
    }

    this.hvacService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    this.batteryService = this.accessory.getService(this.platform.Service.Battery)
      || this.accessory.addService(this.platform.Service.Battery);

    if (this.zone.zoneHumiditySensor) {
      this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
        || this.accessory.addService(this.platform.Service.HumiditySensor);
      this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getHumidity.bind(this));
    } else {
      this.humidityService = null;
    }

    this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.getBatteryStatus.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    this.hvacService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));

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

    setInterval(() => this.softUpdateDeviceCharacteristics(), this.platform.softRefreshInterval);
  }

  async softUpdateDeviceCharacteristics() {
    this.hvacService.updateCharacteristic(this.platform.Characteristic.Active, this.getEnableState());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentCompressorMode());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetClimateMode());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
    this.hvacService.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());
    this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, this.getBatteryStatus());
    this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.getBatteryLevel());

    if (this.humidityService) {
      this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getHumidity());
    }
  }

  checkHvacComms() {
    if (!this.platform.hvacInstance.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getHumidity(): CharacteristicValue {
    const currentHumidity = this.zone.currentHumidity;
    return currentHumidity;
  }

  getBatteryStatus(): CharacteristicValue {
    const currentBattery = this.zone.zoneSensorBattery;
    const batteryState = (currentBattery < 10) ? 1 : 0;
    return batteryState;
  }

  getBatteryLevel(): CharacteristicValue {
    const currentBattery = this.zone.zoneSensorBattery;
    return currentBattery;
  }

  async setEnableState(value: CharacteristicValue) {
    this.checkHvacComms();
    switch (value) {
      case 0:
        await this.zone.setZoneDisable();
        break;
      case 1:
        await this.zone.setZoneEnable();
        break;
    }
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Enable State -> `, value);
  }

  getEnableState(): CharacteristicValue {
    const enableState = (this.zone.zoneEnabled === true) ? 1 : 0;
    return enableState;
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
        this.platform.log.debug('Failed To Get a Valid Compressor Mode -> ', compressorMode);
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
    }
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Climate Mode -> `, value);
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
        this.platform.log.debug('Failed To Get Target Climate Mode -> ', climateMode);
    }
    return currentMode;
  }

  getCurrentTemperature(): CharacteristicValue {
    const currentTemp = this.zone.currentTemp;
    // Convert the temperature to the correct scale (assuming it's in Celsius * 100)
    return Math.min(Math.max(currentTemp / 100, 0), 100);
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    if (this.platform.hvacInstance.zonesPushMaster === true) {
      if (value > this.zone.maxHeatSetPoint) {
        await this.platform.hvacInstance.setHeatTemp(value as number);
        await this.platform.hvacInstance.getStatus();
      } else if (value < this.zone.minHeatSetPoint) {
        await this.platform.hvacInstance.setHeatTemp(value as number + 2);
        await this.platform.hvacInstance.getStatus();
      }
    } else {
      if (value > this.zone.maxHeatSetPoint) {
        value = this.zone.maxHeatSetPoint;
      } else if (value < this.zone.minHeatSetPoint) {
        value = this.zone.minHeatSetPoint;
      }
    }
    await this.zone.setHeatTemp(value as number);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Target Heating Temperature -> `, value);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.zone.currentHeatingSetTemp;
    return targetTemp;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    if (this.platform.hvacInstance.zonesPushMaster === true) {
      this.platform.log.debug('zones push master is set to True');
      if (value > this.zone.maxCoolSetPoint) {
        await this.platform.hvacInstance.setCoolTemp(value as number - 2);
        this.platform.log.debug(`Value is greater than MAX cool set point of ${this.zone.maxCoolSetPoint}, SETTING MASTER TO -> `, value);
        await this.platform.hvacInstance.getStatus();
      } else if (value < this.zone.minCoolSetPoint) {
        await this.platform.hvacInstance.setCoolTemp(value as number);
        this.platform.log.debug(`Value is less than MIN cool set point of ${this.zone.minCoolSetPoint}, SETTING MASTER TO -> `, value);
        await this.platform.hvacInstance.getStatus();
      }
    } else {
      if (value > this.zone.maxCoolSetPoint) {
        value = this.zone.maxCoolSetPoint;
        this.platform.log.debug(`Value is greater than max cool set point of ${this.zone.maxCoolSetPoint}, CHANGING TO -> `, value);
      } else if (value < this.zone.minCoolSetPoint) {
        value = this.zone.minCoolSetPoint;
        this.platform.log.debug(`Value is less than MIN cool set point of ${this.zone.minCoolSetPoint}, CHANGING TO -> `, value);
      }
    }
    await this.zone.setCoolTemp(value as number);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Target Cooling Temperature -> `, value);
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.zone.currentCoolingSetTemp;
    return targetTemp;
  }
}