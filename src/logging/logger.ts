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
export type ForwardedNativeAppLogLevel = Exclude<AppLogLevel, 'temp'>;
export type ForwardedNativeLogEntry = {
  level: ForwardedNativeAppLogLevel;
  message: string;
  sequence: number;
  tag: string;
  timestampMs: number;
};
export type CapturedAppLogRecord = {
  consoleMethod: 'log' | 'info' | 'warn' | 'error';
  level: AppLogLevel;
  renderedMessage: string;
  sequence: number;
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
const isJestEnvironment = Boolean(process.env.JEST_WORKER_ID);
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
const nativeAppLogColorCodes = {
  debug: '\x1b[38;5;98m',
  error: '\x1b[38;5;170m',
  info: '\x1b[38;5;141m',
  temp: appLogColorCodes.temp,
  warn: '\x1b[38;5;134m',
} as const;
const resetTerminalColor = '\x1b[0m';
const forwardedNativeLogMarker = Symbol('forwarded-native-log');
const forwardedNativeOccurredAtMsMarker = Symbol(
  'forwarded-native-occurred-at-ms',
);
let latestObservedLogTimestampMs = 0;
let capturedAppLogSequence = 0;
const capturedAppLogs: CapturedAppLogRecord[] = [];

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';
type AppConsoleTransportOptions = {
  colorsEnabled?: boolean;
  mapLevels?: Record<string, ConsoleMethod>;
};

type ForwardedNativeLogMarkerCarrier = {
  [forwardedNativeLogMarker]?: true;
  [forwardedNativeOccurredAtMsMarker]?: number;
};

const appConsoleTransport: transportFunctionType<AppConsoleTransportOptions> = (
  props,
) => {
  if (!props) {
    return false;
  }

  const logMethod = props.options?.mapLevels?.[props.level.text] ?? 'log';
  const shouldColorize = props.options?.colorsEnabled;
  const colorCode = resolveAppLogColorCode(props);
  const formattedMessage =
    shouldColorize && colorCode
      ? `${colorCode}${props.msg}${resetTerminalColor}`
      : props.msg;
  const renderedMessage =
    logMethod === 'log' ? ` ${formattedMessage}` : formattedMessage;

  dispatchAppLogOutput({
    consoleMethod: logMethod,
    level: props.level.text as AppLogLevel,
    renderedMessage,
  });

  return true;
};

function dispatchAppLogOutput(record: Omit<CapturedAppLogRecord, 'sequence'>) {
  if (isJestEnvironment) {
    capturedAppLogs.push({
      ...record,
      sequence: ++capturedAppLogSequence,
    });
    return;
  }

  const consoleMethods = console as unknown as Record<
    string,
    ((message: string) => void) | undefined
  >;

  if (consoleMethods[record.consoleMethod]) {
    consoleMethods[record.consoleMethod]?.(record.renderedMessage);
  } else {
    console.log(record.renderedMessage);
  }
}

function resolveAppLogColorCode(
  props: Parameters<typeof appConsoleTransport>[0],
): string | undefined {
  const logLevel = props?.level.text as AppLogLevel | undefined;

  if (!logLevel) {
    return undefined;
  }

  if (logLevel === 'temp') {
    return appLogColorCodes.temp;
  }

  return hasForwardedNativeLogMarker(props.rawMsg)
    ? nativeAppLogColorCodes[logLevel]
    : appLogColorCodes[logLevel];
}

function hasForwardedNativeLogMarker(rawMsg: unknown): boolean {
  if (!Array.isArray(rawMsg)) {
    return false;
  }

  return rawMsg.some((messagePart) =>
    Boolean(
      (messagePart as ForwardedNativeLogMarkerCarrier | null)?.[
        forwardedNativeLogMarker
      ],
    ),
  );
}

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

function formatAppLogMessage(
  level: string,
  extension: string | null,
  messages: unknown[],
) {
  const timestampMetadata = getLogTimestampMetadata(messages);
  const paddedLevelLabel = level.toUpperCase().padEnd(appLogLevelLabelWidth);
  const segments = [
    `[${paddedLevelLabel}]`,
    `[${timestampMetadata.isOutOfOrder ? '*' : ''}${timestampMetadata.label}]`,
  ];

  if (extension) {
    segments.push(`[${extension}]`);
  }

  const messageText = messages
    .map((message) => {
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
    })
    .join(' ');

  latestObservedLogTimestampMs = Math.max(
    latestObservedLogTimestampMs,
    timestampMetadata.occurredAtMs,
  );

  return `${segments.join(' ')}: ${messageText}`;
}

function getLogTimestampMetadata(messages: unknown[]) {
  const nativeOccurredAtMs = getForwardedNativeOccurredAtMs(messages);
  const occurredAtMs = nativeOccurredAtMs ?? Date.now();

  return {
    occurredAtMs,
    isOutOfOrder:
      nativeOccurredAtMs != null &&
      latestObservedLogTimestampMs > 0 &&
      nativeOccurredAtMs < latestObservedLogTimestampMs,
    label: formatAppLogTimestamp(new Date()),
  };
}

function getForwardedNativeOccurredAtMs(messages: unknown[]): number | null {
  const carrier = messages.find(
    (messagePart): messagePart is ForwardedNativeLogMarkerCarrier =>
      Boolean(
        (messagePart as ForwardedNativeLogMarkerCarrier | null)?.[
          forwardedNativeLogMarker
        ],
      ),
  );

  return carrier?.[forwardedNativeOccurredAtMsMarker] ?? null;
}

const rootLogger = logger.createLogger({
  levels: appLogLevels,
  severity: defaultAppLogLevel,
  formatFunc: formatAppLogMessage,
  transport: appConsoleTransport,
  transportOptions: {
    colorsEnabled: isDevelopment,
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

export function getCapturedAppLogs(): CapturedAppLogRecord[] {
  return capturedAppLogs.map((record) => ({ ...record }));
}

export function clearCapturedAppLogs() {
  capturedAppLogs.length = 0;
  capturedAppLogSequence = 0;
  latestObservedLogTimestampMs = 0;
}

export function logForwardedNativeEntry(
  loggerInstance: AppLogger,
  entry: ForwardedNativeLogEntry,
  details: AppLogDetails = {},
) {
  const forwardedDetails = {
    ...details,
    nativeTimestamp: formatAppLogTimestamp(new Date(entry.timestampMs)),
  };

  Object.defineProperty(forwardedDetails, forwardedNativeLogMarker, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  Object.defineProperty(forwardedDetails, forwardedNativeOccurredAtMsMarker, {
    configurable: false,
    enumerable: false,
    value: entry.timestampMs,
    writable: false,
  });

  loggerInstance[entry.level](entry.message, forwardedDetails);
}

export function setAppLogLevel(logLevel: AppLogLevel): AppLogLevel {
  const normalizedLogLevel = normalizeAppLogLevel(logLevel);

  return appLogger.setSeverity(normalizedLogLevel) as AppLogLevel;
}

export function getAppLogLevel(): AppLogLevel {
  return appLogger.getSeverity() as AppLogLevel;
}
