import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { ActronQuePlatform } from './platform';
import { FanMode } from './types';

export class ContinuousFanModeAccessory {
  private modeService: Service;

  constructor(
    private readonly platform: ActronQuePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Actron')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.hvacInstance.type + ' Zone Controller');

    // Get or create the switch service
    this.modeService = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    // Set accessory display name
    this.modeService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Set up characteristics
    this.setupSwitchCharacteristics();

    // Set up the update interval
    setInterval(() => this.updateCharacteristics(), this.platform.softRefreshInterval);
  }

  private setupSwitchCharacteristics() {
    this.modeService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setEnableState.bind(this))
      .onGet(this.getEnableState.bind(this));
  }

  async updateCharacteristics() {
    this.modeService.updateCharacteristic(this.platform.Characteristic.On, this.getEnableState());
  }

  checkHvacComms() {
    if (!this.platform.hvacInstance.cloudConnected) {
      this.platform.log.error('Master Controller is offline. Check Master Controller Internet/Wifi connection');
      throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getEnableState(): CharacteristicValue {
    const continuousMode = this.platform.hvacInstance.continuousFanMode;
    return continuousMode;
  }

  async setEnableState(value: CharacteristicValue) {
    this.checkHvacComms();
    if (value) {
      this.platform.hvacInstance.setContinuousFanModeOn();
    } else {
      this.platform.hvacInstance.setContinuousFanModeOff();
    }
    this.platform.log.debug('Set Continuous Fan Mode -> ', value);
  }
}