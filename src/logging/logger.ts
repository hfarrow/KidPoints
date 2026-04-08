import {
  type LoggerInstance,
  logger,
  mapConsoleTransport,
} from 'react-native-logs';

const appLogLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

export type AppLogLevel = keyof typeof appLogLevels;

export type AppLogger = LoggerInstance<AppLogLevel>;
export const APP_LOG_LEVELS = Object.keys(appLogLevels) as AppLogLevel[];

const isDevelopment =
  typeof __DEV__ === 'boolean'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';
const defaultAppLogLevel: AppLogLevel = isDevelopment ? 'debug' : 'info';

const rootLogger = logger.createLogger({
  levels: appLogLevels,
  severity: defaultAppLogLevel,
  transport: mapConsoleTransport,
  transportOptions: {
    mapLevels: {
      debug: 'log',
      info: 'info',
      warn: 'warn',
      error: 'error',
    },
  },
  enabled: true,
  printDate: true,
  printLevel: true,
});

export const appLogger = rootLogger as AppLogger;

export function createModuleLogger(namespace: string): AppLogger {
  return appLogger.extend(namespace) as AppLogger;
}

export function getDefaultAppLogLevel(): AppLogLevel {
  return defaultAppLogLevel;
}

export function setAppLogLevel(logLevel: AppLogLevel): AppLogLevel {
  return appLogger.setSeverity(logLevel) as AppLogLevel;
}

export function getAppLogLevel(): AppLogLevel {
  return appLogger.getSeverity() as AppLogLevel;
}
