import { CommandResult, HvacStatus, ZoneStatus, PowerState, ClimateMode, CompressorMode, FanMode } from '../types';

export const createMockZoneStatus = (overrides: Partial<ZoneStatus> = {}): ZoneStatus => ({
  zoneName: 'Zone 1',
  zoneIndex: 0,
  sensorId: 'sensor-001',
  zoneEnabled: true,
  currentTemp: 22.5,
  currentHeatingSetTemp: 20,
  currentCoolingSetTemp: 24,
  maxHeatSetPoint: 30,
  minHeatSetPoint: 10,
  maxCoolSetPoint: 32,
  minCoolSetPoint: 18,
  currentHumidity: 55,
  zoneSensorBattery: 85,
  ...overrides,
});

export const createMockHvacStatus = (overrides: Partial<HvacStatus> = {}): HvacStatus => ({
  apiError: false,
  cloudConnected: true,
  powerState: PowerState.ON,
  climateMode: ClimateMode.COOL,
  compressorMode: CompressorMode.COOL,
  fanMode: FanMode.AUTO,
  fanRunning: true,
  awayMode: false,
  quietMode: false,
  continuousFanMode: false,
  controlAllZones: false,
  masterCoolingSetTemp: 24,
  masterHeatingSetTemp: 20,
  masterCurrentTemp: 23,
  masterCurrentHumidity: 50,
  zoneCurrentStatus: [createMockZoneStatus()],
  ...overrides,
});

export const createMockQueApi = () => {
  return {
    getStatus: jest.fn().mockResolvedValue(createMockHvacStatus()),
    runCommand: jest.fn().mockResolvedValue(CommandResult.SUCCESS),
    getAcSystems: jest.fn().mockResolvedValue({
      _embedded: {
        'ac-system': [{
          serial: 'TEST123456',
          type: 'Neo',
          description: 'Test AC System',
        }],
      },
    }),
    getZoneStatuses: jest.fn().mockResolvedValue([true, false, true]),
  };
};

export const mockApiResponses = {
  tokenSuccess: {
    access_token: 'mock-access-token',
    expires_in: 3600,
    token_type: 'Bearer',
  },
  bearerTokenSuccess: {
    access_token: 'mock-bearer-token',
    expires_in: 86400,
    token_type: 'Bearer',
  },
  systemStatus: {
    lastKnownState: {
      UserAirconSettings: {
        isOn: true,
        Mode: 'COOL',
        FanMode: 'AUTO',
        AwayMode: false,
        QuietMode: false,
        EnabledZones: [true, true, false],
      },
      LiveAircon: {
        CompressorMode: 'COOL',
        SystemOn: true,
      },
      MasterInfo: {
        LiveTemp_oC: 23.5,
        LiveHumidity_pc: 50,
      },
      RemoteZoneInfo: [
        {
          NV_Title: 'Living Room',
          NV_Exists: true,
          LiveTemp_oC: 22.0,
          LiveHumidity_pc: 55,
          ZonePosition: 0,
          Sensors: [{ Battery_pc: 85, id: 'sensor-001' }],
        },
        {
          NV_Title: 'Bedroom',
          NV_Exists: true,
          LiveTemp_oC: 21.0,
          LiveHumidity_pc: 60,
          ZonePosition: 1,
          Sensors: [{ Battery_pc: 90, id: 'sensor-002' }],
        },
      ],
    },
  },
  commandSuccess: {
    type: 'ack',
  },
  error401: {
    status: 401,
    message: 'Unauthorized',
  },
  error400: {
    status: 400,
    message: 'Bad Request',
  },
  error500: {
    status: 500,
    message: 'Internal Server Error',
  },
};

export const createMockFetch = () => {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(mockApiResponses.systemStatus),
    text: jest.fn().mockResolvedValue(JSON.stringify(mockApiResponses.systemStatus)),
  });
};
