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

type AppLogLevel = keyof typeof appLogLevels;

export type AppLogger = LoggerInstance<AppLogLevel>;

const isDevelopment =
  typeof __DEV__ === 'boolean'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

const rootLogger = logger.createLogger({
  levels: appLogLevels,
  severity: isDevelopment ? 'debug' : 'info',
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
