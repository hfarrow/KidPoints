import {
  type LoggerInstance,
  logger,
  type transportFunctionType,
} from 'react-native-logs';

const appLogLevels = {
  temp: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
} as const;

export type AppLogLevel = keyof typeof appLogLevels;
export type AppLogDetails = Record<string, unknown>;

export type AppLogger = LoggerInstance<AppLogLevel>;
export const SUPPORTED_APP_LOG_LEVELS = Object.keys(
  appLogLevels,
) as AppLogLevel[];

const isDevelopment =
  typeof __DEV__ === 'boolean'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';
const defaultAppLogLevel: AppLogLevel = isDevelopment ? 'debug' : 'info';

const selectableProductionAppLogLevels: AppLogLevel[] = [
  'debug',
  'info',
  'warn',
  'error',
];
const appLogConsoleMethods = {
  temp: 'log',
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
} as const;
const appLogColorCodes = {
  debug: '\x1b[94m',
  error: '\x1b[91m',
  info: '\x1b[96m',
  temp: '\x1b[95m',
  warn: '\x1b[93m',
} as const;
const resetTerminalColor = '\x1b[0m';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';
type AppConsoleTransportOptions = {
  colorsEnabled?: boolean;
  levelColors?: Partial<Record<AppLogLevel, string>>;
  mapLevels?: Record<string, ConsoleMethod>;
};

const appConsoleTransport: transportFunctionType<AppConsoleTransportOptions> = (
  props,
) => {
  if (!props) {
    return false;
  }

  const logMethod = props.options?.mapLevels?.[props.level.text] ?? 'log';
  const shouldColorize = props.options?.colorsEnabled;
  const colorCode =
    props.options?.levelColors?.[props.level.text as AppLogLevel];
  const message =
    shouldColorize && colorCode
      ? `${colorCode}${props.msg}${resetTerminalColor}`
      : props.msg;
  const consoleMethods = console as unknown as Record<
    string,
    ((message: string) => void) | undefined
  >;

  if (consoleMethods[logMethod]) {
    consoleMethods[logMethod]?.(message);
  } else {
    console.log(message);
  }

  return true;
};

export function isAppLogLevel(value: unknown): value is AppLogLevel {
  return (
    typeof value === 'string' &&
    SUPPORTED_APP_LOG_LEVELS.includes(value as AppLogLevel)
  );
}

export function getSelectableAppLogLevels({
  allowTemporaryLogLevel = isDevelopment,
}: {
  allowTemporaryLogLevel?: boolean;
} = {}): AppLogLevel[] {
  return allowTemporaryLogLevel
    ? [...SUPPORTED_APP_LOG_LEVELS]
    : [...selectableProductionAppLogLevels];
}

export function normalizeAppLogLevel(
  logLevel: unknown,
  {
    allowTemporaryLogLevel = isDevelopment,
    fallbackLogLevel = defaultAppLogLevel,
  }: {
    allowTemporaryLogLevel?: boolean;
    fallbackLogLevel?: AppLogLevel;
  } = {},
): AppLogLevel {
  const normalizedFallback =
    isAppLogLevel(fallbackLogLevel) &&
    (allowTemporaryLogLevel || fallbackLogLevel !== 'temp')
      ? fallbackLogLevel
      : defaultAppLogLevel;

  if (!isAppLogLevel(logLevel)) {
    return normalizedFallback;
  }

  if (!allowTemporaryLogLevel && logLevel === 'temp') {
    return normalizedFallback;
  }

  return logLevel;
}

const rootLogger = logger.createLogger({
  levels: appLogLevels,
  severity: defaultAppLogLevel,
  transport: appConsoleTransport,
  transportOptions: {
    colorsEnabled: isDevelopment,
    levelColors: appLogColorCodes,
    mapLevels: appLogConsoleMethods,
  },
  enabled: true,
  printDate: true,
  printLevel: true,
});

export const appLogger = rootLogger as AppLogger;

export function createModuleLogger(namespace: string): AppLogger {
  return appLogger.extend(namespace) as AppLogger;
}

export function createStructuredLog(
  loggerInstance: AppLogger,
  level: AppLogLevel,
  message: string,
) {
  return (details: AppLogDetails = {}) => {
    loggerInstance[level](message, details);
  };
}

export function getDefaultAppLogLevel(): AppLogLevel {
  return defaultAppLogLevel;
}

export function setAppLogLevel(logLevel: AppLogLevel): AppLogLevel {
  const normalizedLogLevel = normalizeAppLogLevel(logLevel);

  return appLogger.setSeverity(normalizedLogLevel) as AppLogLevel;
}

export function getAppLogLevel(): AppLogLevel {
  return appLogger.getSeverity() as AppLogLevel;
}
