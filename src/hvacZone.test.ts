import { HvacZone } from './hvacZone';
import { CommandResult, ZoneStatus } from './types';
import { mockLogger } from './__mocks__/mockHomebridge';
import { createMockZoneStatus } from './__mocks__/mockQueApi';

describe('HvacZone', () => {
  let mockQueApi: {
    runCommand: jest.Mock;
    getStatus: jest.Mock;
  };
  let zone: HvacZone;
  let initialStatus: ZoneStatus;

  beforeEach(() => {
    initialStatus = createMockZoneStatus({
      zoneName: 'Living Room',
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
    });

    mockQueApi = {
      runCommand: jest.fn().mockResolvedValue(CommandResult.SUCCESS),
      getStatus: jest.fn().mockResolvedValue({
        apiError: false,
        zoneCurrentStatus: [initialStatus],
      }),
    };

    zone = new HvacZone(mockLogger, mockQueApi as never, initialStatus);
  });

  describe('constructor', () => {
    it('should initialize with correct values', () => {
      expect(zone.zoneName).toBe('Living Room');
      expect(zone.zoneIndex).toBe(0);
      expect(zone.sensorId).toBe('sensor-001');
      expect(zone.zoneEnabled).toBe(true);
      expect(zone.currentTemp).toBe(22.5);
      expect(zone.currentHeatingSetTemp).toBe(20);
      expect(zone.currentCoolingSetTemp).toBe(24);
      expect(zone.zoneSensorBattery).toBe(85);
    });

    it('should handle humidity sensor when supported', () => {
      expect(zone.zoneHumiditySensor).toBe(true);
      expect(zone.currentHumidity).toBe(55);
    });

    it('should handle humidity sensor when not supported', () => {
      const noHumidityStatus = createMockZoneStatus({
        currentHumidity: 'notSupported',
      });
      const zoneNoHumidity = new HvacZone(mockLogger, mockQueApi as never, noHumidityStatus);

      expect(zoneNoHumidity.zoneHumiditySensor).toBe(false);
      expect(zoneNoHumidity.currentHumidity).toBe('notSupported');
    });
  });

  describe('pushStatusUpdate', () => {
    it('should update zone state', async () => {
      const newStatus = createMockZoneStatus({
        zoneName: 'Living Room',
        zoneEnabled: false,
        currentTemp: 25,
        currentHeatingSetTemp: 22,
        currentCoolingSetTemp: 26,
        currentHumidity: 60,
        zoneSensorBattery: 80,
      });

      await zone.pushStatusUpdate(newStatus);

      expect(zone.zoneEnabled).toBe(false);
      expect(zone.currentTemp).toBe(25);
      expect(zone.currentHeatingSetTemp).toBe(22);
      expect(zone.currentCoolingSetTemp).toBe(26);
      expect(zone.currentHumidity).toBe(60);
      expect(zone.zoneSensorBattery).toBe(80);
    });

    it('should handle humidity not supported in update', async () => {
      const noHumidityStatus = createMockZoneStatus({
        currentHumidity: 'notSupported',
      });
      const zoneNoHumidity = new HvacZone(mockLogger, mockQueApi as never, noHumidityStatus);

      await zoneNoHumidity.pushStatusUpdate(createMockZoneStatus({
        currentHumidity: 'notSupported',
      }));

      expect(zoneNoHumidity.currentHumidity).toBe('notSupported');
    });
  });

  describe('setZoneEnable', () => {
    it('should enable zone on success', async () => {
      zone.zoneEnabled = false;
      mockQueApi.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await zone.setZoneEnable();

      expect(result).toBe(true);
      expect(zone.zoneEnabled).toBe(true);
    });

    it('should refresh state on failure', async () => {
      zone.zoneEnabled = false;
      mockQueApi.runCommand.mockResolvedValue(CommandResult.FAILURE);

      await zone.setZoneEnable();

      expect(mockQueApi.getStatus).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log warning on API error', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.API_ERROR);

      await zone.setZoneEnable();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to send command, Actron Neo Cloud unreachable',
      );
    });
  });

  describe('setZoneDisable', () => {
    it('should disable zone on success', async () => {
      zone.zoneEnabled = true;
      mockQueApi.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await zone.setZoneDisable();

      expect(result).toBe(false);
      expect(zone.zoneEnabled).toBe(false);
    });

    it('should refresh state on failure', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.FAILURE);

      await zone.setZoneDisable();

      expect(mockQueApi.getStatus).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('setHeatTemp', () => {
    it('should set heating temperature on success', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await zone.setHeatTemp(22);

      expect(result).toBe(22);
      expect(zone.currentHeatingSetTemp).toBe(22);
    });

    it('should refresh state and log error on failure', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.FAILURE);

      await zone.setHeatTemp(22);

      expect(mockQueApi.getStatus).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledTimes(2); // Two error messages
    });

    it('should log warning on API error', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.API_ERROR);

      await zone.setHeatTemp(22);

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('setCoolTemp', () => {
    it('should set cooling temperature on success', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.SUCCESS);

      const result = await zone.setCoolTemp(26);

      expect(result).toBe(26);
      expect(zone.currentCoolingSetTemp).toBe(26);
    });

    it('should refresh state on failure', async () => {
      mockQueApi.runCommand.mockResolvedValue(CommandResult.FAILURE);

      await zone.setCoolTemp(26);

      expect(mockQueApi.getStatus).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getZoneStatus', () => {
    it('should return zone status from API', async () => {
      const status = await zone.getZoneStatus();

      expect(mockQueApi.getStatus).toHaveBeenCalled();
      expect(status).toBeDefined();
    });

    it('should return HvacStatus with apiError on failure', async () => {
      mockQueApi.getStatus.mockResolvedValue({
        apiError: true,
        zoneCurrentStatus: [],
      });

      const status = await zone.getZoneStatus();

      expect('apiError' in status).toBe(true);
      expect((status as { apiError: boolean }).apiError).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
