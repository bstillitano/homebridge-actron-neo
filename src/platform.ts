import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MasterControllerAccessory } from './masterControllerAccessory';
import { ZoneControllerAccessory } from './zoneControllerAccessory';
import { AwayModeAccessory } from './awayModeAccessory';
import { ContinuousFanModeAccessory } from './continuousFanModeAccessory';
import { QuietModeAccessory } from './quietModeAccessory';
import { HvacUnit } from './hvac';
import { HvacZone } from './hvacZone';
import { DiscoveredDevices } from './types';
import { HvacSetting } from './hvacSetting';

export class ActronQuePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];

  // Attributes required for initialisation of ActronQue platform
  private readonly clientName: string;
  private readonly username: string;
  private readonly password: string;
  readonly userProvidedSerialNo: string = '';
  readonly zonesFollowMaster: boolean = true;
  readonly zonesPushMaster: boolean = true;
  readonly zonesAsHeaterCoolers: boolean = false;
  readonly hardRefreshInterval: number = 60000;
  readonly softRefreshInterval: number = 5000;
  readonly maxCoolingTemp: number = 32;
  readonly minCoolingTemp: number = 20;
  readonly maxHeatingTemp: number = 26;
  readonly minHeatingTemp: number = 10;
  hvacInstance!: HvacUnit;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.clientName = config['clientName'];
    this.username = config['username'];
    this.password = config['password'];
    if (config['deviceSerial']) {
      this.userProvidedSerialNo = config['deviceSerial'];
      this.log.debug('Serial number should only be added if you have multiple Neo systems. Serial provided ->', this.userProvidedSerialNo);
    }
    if (config['zonesFollowMaster'] !== undefined) {
      this.zonesFollowMaster = config['zonesFollowMaster'];
      this.log.debug('Control All Zones for Master is set to', this.zonesFollowMaster);
    }
    if (config['zonesPushMaster'] !== undefined) {
      this.zonesPushMaster = config['zonesPushMaster'];
      this.log.debug('Zones Push Master is set to', this.zonesPushMaster);
    }
    if (config['zonesAsHeaterCoolers'] !== undefined) {
      this.zonesAsHeaterCoolers = config['zonesAsHeaterCoolers'];
      this.log.debug('Zones As Heater/Coolers is set to', this.zonesAsHeaterCoolers);
    }
    if (config['refreshInterval']) {
      this.hardRefreshInterval = config['refreshInterval'] * 1000;
      this.log.debug('Auto refresh interval set to seconds', this.hardRefreshInterval / 1000);
    }
    if (config['maxCoolingTemp']) {
      this.maxCoolingTemp = config['maxCoolingTemp'];
      this.log.debug('Cooling threshold max set to', this.maxCoolingTemp);
    }
    if (config['minCoolingTemp']) {
      this.minCoolingTemp = config['minCoolingTemp'];
      this.log.debug('Cooling threshold min set to', this.minCoolingTemp);
    }
    if (config['maxHeatingTemp']) {
      this.maxHeatingTemp = config['maxHeatingTemp'];
      this.log.debug('Heating threshold max set to', this.maxHeatingTemp);
    }
    if (config['minHeatingTemp']) {
      this.minHeatingTemp = config['minHeatingTemp'];
      this.log.debug('Heating threshold min set to', this.minHeatingTemp);
    }

    // Check Required Config Fields
    if (!this.username) {
      this.log.error('Username is not configured - aborting plugin start. ' +
        'Please set the field `username` in your config and restart Homebridge.');
      return;
    }

    if (!this.password) {
      this.log.error('Password is not configured - aborting plugin start. ' +
        'Please set the field `password` in your config and restart Homebridge.');
      return;
    }

    if (!this.clientName) {
      this.log.error('Client Name is not configured - aborting plugin start. ' +
        'Please set the field `clientName` in your config and restart Homebridge.');
      return;
    }

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    try {
      // Instantiate an instance of HvacUnit and connect the actronQueApi
      this.hvacInstance = new HvacUnit(this.clientName, this.log, this.api.user.storagePath(),
        this.zonesFollowMaster, this.zonesPushMaster, this.zonesAsHeaterCoolers);
      let hvacSerial = '';
      hvacSerial = await this.hvacInstance.actronQueApi(this.username, this.password, this.userProvidedSerialNo);
      // Make sure we have hvac master and zone data before adding devices
      await this.hvacInstance.getStatus();
      const devices: DiscoveredDevices[] = [
        {
          type: 'masterController',
          uniqueId: hvacSerial,
          displayName: this.clientName,
          instance: this.hvacInstance,
        },
        {
          type: 'awayModeController',
          uniqueId: 'neo-away-mode',
          displayName: 'Away Mode',
          instance: new HvacSetting('away-mode', 'Away Mode'),
        },
        {
          type: 'quietModeController',
          uniqueId: 'neo-quiet-mode',
          displayName: 'Quiet Mode',
          instance: new HvacSetting('quiet-mode', 'Quiet Mode'),
        },
        {
          type: 'continuousFanModeController',
          uniqueId: 'neo-continuos-fan-mode',
          displayName: 'Continuous Mode',
          instance: new HvacSetting('continuous-fan-mode', 'Continuous Fan Mode'),
        },
      ];
      for (const zone of this.hvacInstance.zoneInstances) {
        devices.push({
          type: 'zoneController',
          uniqueId: zone.zoneName,
          displayName: zone.zoneName,
          instance: zone,
        });
      }
      this.log.debug('Discovered Devices \n', devices);
      // loop over the discovered devices and register each one if it has not already been registered
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.uniqueId);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          if (device.type === 'masterController') {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new MasterControllerAccessory(this, existingAccessory);
          } else if (device.type === 'zoneController') {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new ZoneControllerAccessory(this, existingAccessory, device.instance as HvacZone);
          } else if (device.type === 'awayModeController') {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new AwayModeAccessory(this, existingAccessory);
          } else if (device.type === 'quietModeController') {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new QuietModeAccessory(this, existingAccessory);
          } else if (device.type === 'continuousFanModeController') {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new ContinuousFanModeAccessory(this, existingAccessory);
          }
        } else {
          this.log.info('Adding new accessory:', device.displayName);
          const accessory = new this.api.platformAccessory(device.displayName, uuid);
          accessory.context.device = device;
          if (device.type === 'masterController') {
            new MasterControllerAccessory(this, accessory);
          } else if (device.type === 'zoneController') {
            new ZoneControllerAccessory(this, accessory, device.instance as HvacZone);
          } else if (device.type === 'awayModeController') {
            new AwayModeAccessory(this, accessory);
          } else if (device.type === 'quietModeController') {
            new QuietModeAccessory(this, accessory);
          } else if (device.type === 'continuousFanModeController') {
            new ContinuousFanModeAccessory(this, accessory);
          }
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(error.message);
      }
      this.log.error('Plugin disabled. Please review error log, check your config file, then restart Homebridge');
    }
  }
}