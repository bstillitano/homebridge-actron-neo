import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ActronAirNeoPlatform } from './platform';
import { HvacZone } from './hvacZone';

export class ZoneControllerAccessory {
  private switchService: Service;
  private humidityService: Service | null;
  private batteryService: Service;
  private temperatureService: Service;

  constructor(
    private readonly platform: ActronAirNeoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly zone: HvacZone,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'ActronAir')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Zone Controller')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.zone.sensorId);

    // Switch service for toggling the zone on/off
    this.switchService = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    this.switchService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Temperature sensor service
    this.temperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    // Battery service
    this.batteryService = this.accessory.getService(this.platform.Service.Battery)
      || this.accessory.addService(this.platform.Service.Battery);

    // Humidity sensor service (if supported)
    if (this.zone.zoneHumiditySensor) {
      this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
        || this.accessory.addService(this.platform.Service.HumiditySensor);
      this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getHumidity.bind(this));
    } else {
      this.humidityService = null;
    }

    // Set up characteristics
    this.switchService.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getZoneState.bind(this))
      .onSet(this.setZoneState.bind(this));

    this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.getBatteryStatus.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));

    setInterval(() => this.updateDeviceCharacteristics(), this.platform.softRefreshInterval);
  }

  async updateDeviceCharacteristics() {
    this.switchService.updateCharacteristic(this.platform.Characteristic.On, this.getZoneState());
    this.temperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getCurrentTemperature());
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

  getZoneState(): CharacteristicValue {
    return this.zone.zoneEnabled;
  }

  async setZoneState(value: CharacteristicValue) {
    this.checkHvacComms();
    if (value) {
      await this.zone.setZoneEnable();
    } else {
      await this.zone.setZoneDisable();
    }
    this.platform.log.debug(`Set Zone ${this.zone.zoneName} State -> `, value);
  }

  getCurrentTemperature(): CharacteristicValue {
    // Assuming the temperature is in Celsius and needs to be converted from a larger scale
    return Math.min(Math.max(this.zone.currentTemp / 100, -270), 100);
  }

  getHumidity(): CharacteristicValue {
    return this.zone.currentHumidity;
  }

  getBatteryStatus(): CharacteristicValue {
    return this.zone.zoneSensorBattery < 10 ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  getBatteryLevel(): CharacteristicValue {
    return this.zone.zoneSensorBattery;
  }
}