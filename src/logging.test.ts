import { Logger } from 'homebridge';
import { createPluginLogger } from './logging';

describe('createPluginLogger', () => {
  const makeBase = () => ({
    prefix: 'test',
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  }) as unknown as Logger;

  it('returns the base logger unchanged when debug is disabled', () => {
    const base = makeBase();
    expect(createPluginLogger(base, false)).toBe(base);
  });

  it('routes debug messages to info when debug is enabled', () => {
    const base = makeBase();
    const logger = createPluginLogger(base, true);

    logger.debug('hello', 1, 2);

    expect(base.info).toHaveBeenCalledWith('hello', 1, 2);
    expect(base.debug).not.toHaveBeenCalled();
  });

  it('leaves other levels untouched when debug is enabled', () => {
    const base = makeBase();
    const logger = createPluginLogger(base, true);

    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(base.info).toHaveBeenCalledWith('i');
    expect(base.warn).toHaveBeenCalledWith('w');
    expect(base.error).toHaveBeenCalledWith('e');
  });
});
