import { Logger } from 'homebridge';

// Returns a logger that surfaces debug-level messages at info level when the plugin's
// `debug` option is enabled, so users can get verbose logging for just this plugin
// without running the whole Homebridge instance in debug mode (`homebridge -D`).
//
// When the option is disabled the base logger is returned unchanged, so debug messages
// stay on Homebridge's globally-gated debug channel as before. When enabled, only the
// `debug` method is redirected to `info`; every other level is left untouched.
export function createPluginLogger(base: Logger, debugEnabled: boolean): Logger {
  if (!debugEnabled) {
    return base;
  }
  // Inherit every method/property of the base logger, then override only debug. Using the
  // base as prototype keeps info/warn/error/success/log behaving exactly as they do now.
  const wrapped: Logger = Object.create(base);
  wrapped.debug = (message: string, ...parameters: unknown[]) => base.info(message, ...parameters);
  return wrapped;
}
