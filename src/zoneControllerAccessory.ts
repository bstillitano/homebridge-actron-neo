import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ClimateMode, CompressorMode } from './types';
import { ActronQuePlatform } from './platform';
import { HvacZone } from './hvacZone';

export class ZoneControllerAccessory {
  private zoneService: Service;
  private temperatureService: Service | undefined;
  private humidityService: Service | undefined;
  private batteryService: Service;
  private lastLoggedHumidity: number | null = null;

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

    // Get or create zone service based on config
    if (this.platform.zonesAsHeaterCoolers) {
      // Remove any existing Switch service when using HeaterCooler mode
      const existingSwitch = this.accessory.getService(this.platform.Service.Switch);
      if (existingSwitch) {
        this.accessory.removeService(existingSwitch);
      }
      this.zoneService = this.accessory.getService(this.platform.Service.HeaterCooler)
        || this.accessory.addService(this.platform.Service.HeaterCooler);
    } else {
      // Remove any existing HeaterCooler service when using Switch mode
      const existingHeaterCooler = this.accessory.getService(this.platform.Service.HeaterCooler);
      if (existingHeaterCooler) {
        this.accessory.removeService(existingHeaterCooler);
      }
      this.zoneService = this.accessory.getService(this.platform.Service.Switch)
        || this.accessory.addService(this.platform.Service.Switch);
    }

    // Remove temperature sensor - HeaterCooler has built-in temp, Switch mode doesn't need it
    const existingTempSensor = this.accessory.getService(this.platform.Service.TemperatureSensor);
    if (existingTempSensor) {
      this.accessory.removeService(existingTempSensor);
    }
    // For HeaterCooler mode, use the zoneService for temperature characteristics
    if (this.platform.zonesAsHeaterCoolers) {
      this.temperatureService = this.zoneService;
    }

    // Get or create the humidity sensor service (only for HeaterCooler mode)
    if (this.platform.zonesAsHeaterCoolers) {
      this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
        || this.accessory.addService(this.platform.Service.HumiditySensor);
    } else {
      // Remove humidity sensor when using Switch mode
      const existingHumiditySensor = this.accessory.getService(this.platform.Service.HumiditySensor);
      if (existingHumiditySensor) {
        this.accessory.removeService(existingHumiditySensor);
      }
    }

    // Get or create the battery service
    this.batteryService = this.accessory.getService(this.platform.Service.Battery)
      || this.accessory.addService(this.platform.Service.Battery);

    // Set accessory display name
    this.zoneService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Set up characteristics based on service type
    if (this.platform.zonesAsHeaterCoolers) {
      this.setupHeaterCoolerCharacteristics();
      this.setupHumidityCharacteristics();
    } else {
      this.setupSwitchCharacteristics();
    }
    this.setupBatteryCharacteristics();

    // Set up the update interval
    setInterval(() => this.updateCharacteristics(), this.platform.softRefreshInterval);
  }

  private setupSwitchCharacteristics() {
    this.zoneService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));
  }

  private setupHeaterCoolerCharacteristics() {
    // Active characteristic (zone enable/disable)
    this.zoneService.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActiveState.bind(this))
      .onGet(this.getActiveState.bind(this));

    // Current heater/cooler state (from master)
    this.zoneService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    // Target heater/cooler state (from master, read-only for zones)
    this.zoneService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this));

    // Current temperature
    this.zoneService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Heating threshold temperature
    this.zoneService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: Math.max(10, this.zone.minHeatSetPoint),
        maxValue: this.zone.maxHeatSetPoint,
        minStep: 0.5,
      })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    // Cooling threshold temperature
    this.zoneService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.zone.minCoolSetPoint,
        maxValue: this.zone.maxCoolSetPoint,
        minStep: 0.5,
      })
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));
  }

  private setupTemperatureCharacteristics() {
    this.temperatureService?.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  private setupHumidityCharacteristics() {
    this.humidityService?.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentHumidity.bind(this));
  }

  private setupBatteryCharacteristics() {
    this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));
    this.batteryService.getCharacteristic(this.platform.Characteristic.ChargingState)
      .onGet(this.getChargingState.bind(this));
    this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.getLowBatteryStatus.bind(this));
  }

  async updateCharacteristics() {
    if (this.platform.zonesAsHeaterCoolers) {
      // Update HeaterCooler characteristics
      this.zoneService.updateCharacteristic(this.platform.Characteristic.Active, this.getActiveState());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerState());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.getTargetHeaterCoolerState());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.getHeatingThresholdTemperature());
      this.zoneService.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.getCoolingThresholdTemperature());
      this.humidityService?.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getCurrentHumidity());
    } else {
      // Update Switch characteristics
      this.zoneService.updateCharacteristic(this.platform.Characteristic.On, this.getEnableState());
    }
    this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.getBatteryLevel());
    this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, this.getLowBatteryStatus());
  }

  checkHvacComms() {
    if (!this.platform.hvacInstance.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getHumidity(): CharacteristicValue {
    const currentHumidity = this.zone.currentHumidity;
    if (typeof currentHumidity === 'number') {
      if (this.lastLoggedHumidity === null || currentHumidity !== this.lastLoggedHumidity) {
        this.platform.log.debug(`Humidity changed for zone ${this.zone.zoneName}: ${currentHumidity}`);
        this.lastLoggedHumidity = currentHumidity;
      }
      return currentHumidity;
    } else {
      if (this.lastLoggedHumidity !== null) {
        this.platform.log.warn(`Humidity not supported for zone ${this.zone.zoneName}`);
        this.lastLoggedHumidity = null;
      }
      return 0;
    }
  }

  getBatteryLevel(): CharacteristicValue {
    return this.zone.zoneSensorBattery;
  }

  getChargingState(): CharacteristicValue {
    // Assuming the battery is not chargeable
    return this.platform.Characteristic.ChargingState.NOT_CHARGEABLE;
  }

  getLowBatteryStatus(): CharacteristicValue {
    return this.zone.zoneSensorBattery < 20
      ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
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

  getCurrentTemperature(): CharacteristicValue {
    return this.zone.currentTemp;
  }

  getCurrentHumidity(): CharacteristicValue {
    return this.getHumidity();
  }

  // HeaterCooler-specific methods
  async setActiveState(value: CharacteristicValue) {
    this.checkHvacComms();
    if (value as number === this.platform.Characteristic.Active.ACTIVE) {
      await this.zone.setZoneEnable();
    } else {
      await this.zone.setZoneDisable();
    }
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Active State -> `, value);
  }

  getActiveState(): CharacteristicValue {
    return this.zone.zoneEnabled
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;
  }

  getCurrentHeaterCoolerState(): CharacteristicValue {
    // Get compressor mode from master controller
    const compressorMode = this.platform.hvacInstance.compressorMode;
    let currentState: number;

    switch (compressorMode) {
      case CompressorMode.OFF:
        currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        break;
      case CompressorMode.HEAT:
        currentState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      case CompressorMode.COOL:
        currentState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      default:
        currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    // If fan is not running, system is idle
    if (!this.platform.hvacInstance.fanRunning) {
      currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    return currentState;
  }

  getTargetHeaterCoolerState(): CharacteristicValue {
    // Get climate mode from master controller (zones follow master)
    const climateMode = this.platform.hvacInstance.climateMode;
    let targetState: number;

    switch (climateMode) {
      case ClimateMode.AUTO:
        targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        break;
      case ClimateMode.HEAT:
        targetState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        break;
      case ClimateMode.COOL:
        targetState = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
        break;
      default:
        targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }

    return targetState;
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    return this.zone.currentHeatingSetTemp;
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    await this.zone.setHeatTemp(value as number);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Heating Temperature -> `, value);
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    return this.zone.currentCoolingSetTemp;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.checkHvacComms();
    await this.zone.setCoolTemp(value as number);
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} Cooling Temperature -> `, value);
  }
}