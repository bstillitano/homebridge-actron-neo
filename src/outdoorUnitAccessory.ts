import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ActronQuePlatform } from './platform';

export class OutdoorUnitAccessory {
  private temperatureService: Service;
  private readonly TEMPERATURE_UNAVAILABLE = 3000;  // The value Actron uses when temperature is unavailable
  private lastTemperatureAvailability: boolean | null = null;

  constructor(
    private readonly platform: ActronQuePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Actron')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Outdoor Unit')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.hvacInstance.serialNo);

    // Get or create the temperature sensor service.
    this.temperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    // Set accessory display name, this is taken from discover devices in platform
    this.temperatureService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this))
      .setProps({
        minValue: -50,
        maxValue: 100,
        minStep: 0.1
      });

    // Set up the refresh interval
    setInterval(() => this.updateDeviceCharacteristics(), this.platform.softRefreshInterval);
  }

  async updateDeviceCharacteristics() {
    const currentTemp = this.getCurrentTemperature();
    if (currentTemp !== undefined) {
      this.temperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, currentTemp);
    }
  }

  getCurrentTemperature(): CharacteristicValue {
    const currentTemp = this.platform.hvacInstance.outdoorTemp;
    
    const isAvailable = currentTemp !== this.TEMPERATURE_UNAVAILABLE;

    if (isAvailable !== this.lastTemperatureAvailability) {
      if (!isAvailable) {
        this.platform.log.warn('Outdoor temperature reading became unavailable');
      } else {
        this.platform.log.info('Outdoor temperature reading became available');
      }
      this.lastTemperatureAvailability = isAvailable;
    }

    if (!isAvailable) {
      // Return a default value when temperature is unavailable
      return 0;
    } else if (currentTemp >= -50 && currentTemp <= 100) {
      this.platform.log.debug('Got outdoor temperature -> ', currentTemp);
      return currentTemp;
    } else {
      this.platform.log.warn(`Invalid outdoor temperature reading: ${currentTemp}, returning default value`);
      return 0;
    }
  }
}