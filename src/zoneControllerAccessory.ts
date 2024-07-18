import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ClimateMode, CompressorMode } from './types';
import { ActronQuePlatform } from './platform';
import { HvacZone } from './hvacZone';

// This class represents the zone controller
export class ZoneControllerAccessory {
  private zoneService: Service;
  private humidityService: Service | null;
  private batteryService: Service;

  constructor(
    private readonly platform: ActronQuePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly zone: HvacZone,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Actron')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Zone Controller')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.zone.sensorId);

    // Get or create the appropriate service based on configuration
    if (this.platform.zonesAsHeaterCoolers) {
      this.zoneService = this.accessory.getService(this.platform.Service.HeaterCooler)
        || this.accessory.addService(this.platform.Service.HeaterCooler);
    } else {
      this.zoneService = this.accessory.getService(this.platform.Service.Switch)
        || this.accessory.addService(this.platform.Service.Switch);
    }

    // Set accessory display name
    this.zoneService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Get or create the battery service
    this.batteryService = this.accessory.getService(this.platform.Service.Battery)
      || this.accessory.addService(this.platform.Service.Battery);

    // Get or create the humidity sensor service if the zone sensor supports humidity readings
    if (this.zone.zoneHumiditySensor) {
      this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
        || this.accessory.addService(this.platform.Service.HumiditySensor);
      this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getHumidity.bind(this));
    } else {
      this.humidityService = null;
    }

    // Set up characteristics based on service type
    if (this.platform.zonesAsHeaterCoolers) {
      this.setupHeaterCoolerCharacteristics();
    } else {
      this.setupSwitchCharacteristics();
    }

    // Set up common characteristics
    this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.getBatteryStatus.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    setInterval(() => this.updateDeviceCharacteristics(), this.platform.softRefreshInterval);
  }

  private setupSwitchCharacteristics() {
    this.zoneService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));
  }

  private setupHeaterCoolerCharacteristics() {
    this.zoneService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));

    this.zoneService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentCompressorMode.bind(this));

    this.zoneService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetClimateMode.bind(this))
      .onSet(this.setTargetClimateMode.bind(this));

    this.zoneService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.zoneService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.platform.minHeatingTemp,
        maxValue: this.platform.maxHeatingTemp,
        minStep: 0.5,
      })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.zoneService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.platform.minCoolingTemp,
        maxValue: this.platform.maxCoolingTemp,
        minStep: 0.5,
      })
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));
  }

  async updateDeviceCharacteristics() {
    if (this.platform.zonesAsHeaterCoolers) {
      this.zoneService.updateCharacteristic(this.platform.Characteristic.Active, this.getEnableState());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentCompressorMode());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetClimateMode());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());
    } else {
      this.zoneService.updateCharacteristic(this.platform.Characteristic.On, this.getEnableState());
    }

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
    return this.zone.zoneSensorBattery < 10 ? 1 : 0;
  }

  getBatteryLevel(): CharacteristicValue {
    return this.zone.zoneSensorBattery;
  }

  async setEnableState(value: CharacteristicValue) {
    this.checkHvacComms();
    if (value as boolean) {
      await this.zone.setZoneEnable();
    } else {
      await this.zone.setZoneDisable();
    }
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Enable State -> `, value);
  }

  getEnableState(): CharacteristicValue {
    return this.zone.zoneEnabled ? 1 : 0;
  }

  getCurrentCompressorMode(): CharacteristicValue {
    let currentMode: number;
    const compressorMode = this.platform.hvacInstance.compressorMode;
    switch (compressorMode) {
      case CompressorMode.OFF:
        currentMode = this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        break;
      case CompressorMode.HEAT:
        currentMode = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      case CompressorMode.COOL:
        currentMode = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      default:
        currentMode = this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
    if (!this.platform.hvacInstance.fanRunning) {
      currentMode = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
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
        currentMode = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
    return currentMode;
  }

  getCurrentTemperature(): CharacteristicValue {
    const currentTemp = this.zone.currentTemp;
    return currentTemp;
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    const numericValue = value as number;
    if (this.platform.hvacInstance.zonesPushMaster === true) {
      if (numericValue > this.zone.maxHeatSetPoint) {
        await this.platform.hvacInstance.setHeatTemp(numericValue);
        await this.platform.hvacInstance.getStatus();
      } else if (numericValue < this.zone.minHeatSetPoint) {
        await this.platform.hvacInstance.setHeatTemp(numericValue + 2);
        await this.platform.hvacInstance.getStatus();
      }
    } else {
      if (numericValue > this.zone.maxHeatSetPoint) {
        value = this.zone.maxHeatSetPoint;
      } else if (numericValue < this.zone.minHeatSetPoint) {
        value = this.zone.minHeatSetPoint;
      }
    }
    await this.zone.setHeatTemp(numericValue);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Target Heating Temperature -> `, value);
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.zone.currentHeatingSetTemp;
    return targetTemp;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    const numericValue = value as number;
    if (this.platform.hvacInstance.zonesPushMaster === true) {
      if (numericValue > this.zone.maxCoolSetPoint) {
        await this.platform.hvacInstance.setCoolTemp(numericValue - 2);
        await this.platform.hvacInstance.getStatus();
      } else if (numericValue < this.zone.minCoolSetPoint) {
        await this.platform.hvacInstance.setCoolTemp(numericValue);
        await this.platform.hvacInstance.getStatus();
      }
    } else {
      if (numericValue > this.zone.maxCoolSetPoint) {
        value = this.zone.maxCoolSetPoint;
      } else if (numericValue < this.zone.minCoolSetPoint) {
        value = this.zone.minCoolSetPoint;
      }
    }
    await this.zone.setCoolTemp(numericValue);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Target Cooling Temperature -> `, value);
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    const targetTemp = this.zone.currentCoolingSetTemp;
    return targetTemp;
  }
}