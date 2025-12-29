import { Logger, PlatformConfig, API, PlatformAccessory, Service, Characteristic } from 'homebridge';

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
} as unknown as jest.Mocked<Logger>;

export const createMockCharacteristic = () => {
  const characteristic = {
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
    setProps: jest.fn().mockReturnThis(),
    updateValue: jest.fn().mockReturnThis(),
    value: null,
  };
  return characteristic;
};

export const createMockService = () => {
  const characteristics = new Map<string, ReturnType<typeof createMockCharacteristic>>();

  const service = {
    getCharacteristic: jest.fn().mockImplementation((char: unknown) => {
      const key = String(char);
      if (!characteristics.has(key)) {
        characteristics.set(key, createMockCharacteristic());
      }
      return characteristics.get(key);
    }),
    setCharacteristic: jest.fn().mockReturnThis(),
    updateCharacteristic: jest.fn().mockReturnThis(),
    addLinkedService: jest.fn().mockReturnThis(),
  };
  return service;
};

export const createMockAccessory = (displayName = 'Test Accessory'): jest.Mocked<PlatformAccessory> => {
  const services = new Map<string, ReturnType<typeof createMockService>>();

  // Pre-add the AccessoryInformation service that all accessories expect
  services.set('AccessoryInformation', createMockService());

  return {
    displayName,
    UUID: 'test-uuid-1234',
    category: 1,
    context: {},
    getService: jest.fn().mockImplementation((serviceType: unknown) => {
      const key = String(serviceType);
      return services.get(key) || null;
    }),
    addService: jest.fn().mockImplementation((serviceType: unknown) => {
      const key = String(serviceType);
      const service = createMockService();
      services.set(key, service);
      return service;
    }),
    removeService: jest.fn(),
    getServiceById: jest.fn(),
    configureController: jest.fn(),
  } as unknown as jest.Mocked<PlatformAccessory>;
};

export const createMockApi = (): jest.Mocked<API> => {
  return {
    hap: {
      uuid: {
        generate: jest.fn().mockImplementation((id: string) => `uuid-${id}`),
      },
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        HeaterCooler: 'HeaterCooler',
        HumiditySensor: 'HumiditySensor',
        TemperatureSensor: 'TemperatureSensor',
        Switch: 'Switch',
        Battery: 'Battery',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        Active: { ACTIVE: 1, INACTIVE: 0 },
        CurrentHeaterCoolerState: { INACTIVE: 0, IDLE: 1, HEATING: 2, COOLING: 3 },
        TargetHeaterCoolerState: { AUTO: 0, HEAT: 1, COOL: 2 },
        CurrentTemperature: 'CurrentTemperature',
        HeatingThresholdTemperature: 'HeatingThresholdTemperature',
        CoolingThresholdTemperature: 'CoolingThresholdTemperature',
        RotationSpeed: 'RotationSpeed',
        CurrentRelativeHumidity: 'CurrentRelativeHumidity',
        On: 'On',
        BatteryLevel: 'BatteryLevel',
        ChargingState: { NOT_CHARGEABLE: 2 },
        StatusLowBattery: { BATTERY_LEVEL_NORMAL: 0, BATTERY_LEVEL_LOW: 1 },
      },
      HapStatusError: class HapStatusError extends Error {
        constructor(public hapStatus: number) {
          super(`HAP Status Error: ${hapStatus}`);
        }
      },
      HAPStatus: {
        SERVICE_COMMUNICATION_FAILURE: -70402,
      },
    },
    on: jest.fn(),
    registerPlatformAccessories: jest.fn(),
    unregisterPlatformAccessories: jest.fn(),
    updatePlatformAccessories: jest.fn(),
    platformAccessory: jest.fn(),
  } as unknown as jest.Mocked<API>;
};

export const createMockConfig = (overrides: Partial<PlatformConfig> = {}): PlatformConfig => {
  return {
    platform: 'ActronNeo',
    name: 'ActronNeo',
    username: 'test@example.com',
    password: 'testpassword',
    clientName: 'testClient',
    zonesFollowMaster: true,
    zonesPushMaster: true,
    zonesAsHeaterCoolers: false,
    refreshInterval: 60,
    deviceSerial: '',
    maxCoolingTemp: 32,
    minCoolingTemp: 20,
    maxHeatingTemp: 26,
    minHeatingTemp: 10,
    ...overrides,
  };
};
