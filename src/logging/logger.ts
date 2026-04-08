import {
  type LoggerInstance,
  logger,
  type transportFunctionType,
} from 'react-native-logs';
import { appendAppBufferedLogEntry } from './logBufferStore';

const appLogLevels = {
  temp: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
} as const;

export type AppLogLevel = keyof typeof appLogLevels;
export type AppLogDetails = Record<string, unknown>;
export type ForwardedNativeAppLogLevel = Exclude<AppLogLevel, 'temp'>;

export type ForwardedNativeLogEntry = {
  level: ForwardedNativeAppLogLevel;
  message: string;
  sequence: number;
  tag: string;
  timestampMs: number;
};

export type AppLogger = LoggerInstance<AppLogLevel>;
export const SUPPORTED_APP_LOG_LEVELS = Object.keys(
  appLogLevels,
) as AppLogLevel[];
const appLogLevelLabelWidth = SUPPORTED_APP_LOG_LEVELS.reduce(
  (maxWidth, logLevel) => Math.max(maxWidth, logLevel.length),
  0,
);
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
  debug: '\x1b[38;5;246m',
  error: '\x1b[38;5;248m',
  info: '\x1b[38;5;255m',
  temp: '\x1b[38;5;67m',
  warn: '\x1b[38;5;250m',
} as const;
const resetTerminalColor = '\x1b[0m';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';
type AppConsoleTransportOptions = {
  colorsEnabled?: boolean;
  levelColors?: Partial<Record<AppLogLevel, string>>;
  mapLevels?: Record<string, ConsoleMethod>;
};

type FormattedAppLogMessage = {
  fullText: string;
  previewText: string;
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
  const formattedMessage =
    shouldColorize && colorCode
      ? `${colorCode}${props.msg}${resetTerminalColor}`
      : props.msg;
  const message =
    logMethod === 'log' ? ` ${formattedMessage}` : formattedMessage;
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

function formatAppLogTimestamp(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function serializeAppLogMessagePart(message: unknown) {
  if (typeof message === 'string') {
    return message;
  }

  if (typeof message === 'function') {
    return `[function ${message.name || 'anonymous'}()]`;
  }

  if (message instanceof Error) {
    return message.message;
  }

  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return '[[Unserializable Value]]';
  }
}

function buildAppLogPreview(messages: unknown[]) {
  for (const message of messages) {
    const serializedMessage = serializeAppLogMessagePart(message);
    const previewLine = serializedMessage
      .split(/\r?\n/u)
      .find((line) => line.trim().length > 0);

    if (previewLine) {
      return previewLine.trim();
    }
  }

  return 'Log entry';
}

function buildFormattedAppLogMessage({
  extension,
  level,
  messages,
  timestampMs,
}: {
  extension: string | null;
  level: string;
  messages: unknown[];
  timestampMs: number;
}): FormattedAppLogMessage {
  const timestamp = formatAppLogTimestamp(new Date(timestampMs));
  const paddedLevelLabel = level.toUpperCase().padEnd(appLogLevelLabelWidth);
  const segments = [`[${paddedLevelLabel}]`, `[${timestamp}]`];

  if (extension) {
    segments.push(`[${extension}]`);
  }

  const messageText = messages.map(serializeAppLogMessagePart).join(' ');

  return {
    fullText: `${segments.join(' ')}: ${messageText}`,
    previewText: buildAppLogPreview(messages),
  };
}

function formatAppLogMessage(
  level: string,
  extension: string | null,
  messages: unknown[],
) {
  const timestampMs = Date.now();
  const { fullText, previewText } = buildFormattedAppLogMessage({
    extension,
    level,
    messages,
    timestampMs,
  });

  appendAppBufferedLogEntry({
    fullText,
    level: isAppLogLevel(level) ? level : defaultAppLogLevel,
    namespace: extension,
    previewText,
    timestampMs,
  });

  return fullText;
}

const rootLogger = logger.createLogger({
  levels: appLogLevels,
  severity: defaultAppLogLevel,
  formatFunc: formatAppLogMessage,
  transport: appConsoleTransport,
  transportOptions: {
    colorsEnabled: isDevelopment,
    levelColors: appLogColorCodes,
    mapLevels: appLogConsoleMethods,
  },
  enabled: true,
  printDate: false,
  printLevel: false,
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

export function isAppLogLevelAtLeast(
  logLevel: AppLogLevel,
  minimumLogLevel: AppLogLevel,
) {
  return appLogLevels[logLevel] >= appLogLevels[minimumLogLevel];
}

export function logForwardedNativeEntry(
  loggerInstance: AppLogger,
  entry: ForwardedNativeLogEntry,
  details: AppLogDetails = {},
) {
  loggerInstance[entry.level](entry.message, {
    ...details,
    nativeSequence: entry.sequence,
    nativeTag: entry.tag,
    nativeTimestamp: formatAppLogTimestamp(new Date(entry.timestampMs)),
    nativeTimestampMs: entry.timestampMs,
  });
}

export function setAppLogLevel(logLevel: AppLogLevel): AppLogLevel {
  const normalizedLogLevel = normalizeAppLogLevel(logLevel);

  return appLogger.setSeverity(normalizedLogLevel) as AppLogLevel;
}

export function getAppLogLevel(): AppLogLevel {
  return appLogger.getSeverity() as AppLogLevel;
}
