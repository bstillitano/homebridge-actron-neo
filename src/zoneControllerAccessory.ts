import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ActronQuePlatform } from './platform';
import { HvacZone } from './hvacZone';

export class ZoneControllerAccessory {
  private zoneService: Service;
  private temperatureService: Service;
  private humidityService: Service;
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

    // Get or create the switch service
    this.zoneService = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    // Get or create the temperature sensor service
    this.temperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    // Get or create the humidity sensor service
    this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
      || this.accessory.addService(this.platform.Service.HumiditySensor);

    // Get or create the battery service
    this.batteryService = this.accessory.getService(this.platform.Service.BatteryService)
      || this.accessory.addService(this.platform.Service.BatteryService);

    // Set accessory display name
    this.zoneService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Set up characteristics
    this.setupSwitchCharacteristics();
    this.setupTemperatureCharacteristics();
    this.setupHumidityCharacteristics();
    this.setupBatteryCharacteristics();

    // Set up the update interval
    setInterval(() => this.updateCharacteristics(), this.platform.softRefreshInterval);
  }

  private setupSwitchCharacteristics() {
    this.zoneService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));
  }

  private setupTemperatureCharacteristics() {
    this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  private setupHumidityCharacteristics() {
    this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
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
    this.zoneService.updateCharacteristic(this.platform.Characteristic.On, this.getEnableState());
    this.temperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
    this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.getCurrentHumidity());
    this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.getBatteryLevel());
    this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, this.getLowBatteryStatus());
  }

  checkHvacComms() {
    if (!this.platform.hvacInstance.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
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
    return this.zone.currentHumidity;
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
}