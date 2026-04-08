# Logging

This note documents the preferred logging approach for KidPoints.

## Goals

- Keep logging centralized behind the shared app logger.
- Make logs easy to scan by using stable module namespaces.
- Preserve important production diagnostics without flooding the console.
- Keep logging side effects out of React render paths.

## Current implementation

- The shared logger lives at `src/logging/logger.ts`.
- Import `appLogger` for app-wide logs without a module namespace.
- Import `createModuleLogger(namespace)` to create a namespaced logger for a feature, screen, or module.
- Import `createStructuredLog(logger, level, message)` when a module repeats the same log level and message with different detail objects.
- `APP_LOG_LEVELS`, `getAppLogLevel()`, `setAppLogLevel(...)`, and `getDefaultAppLogLevel()` expose the supported runtime log-level controls.
- The logger is configured with `react-native-logs` and `mapConsoleTransport`.
- Default severity is `debug` in development and `info` in production.
- The active log level is persisted in local settings and can be changed from the Settings screen, including in release builds.

## Preferred usage

For most files, create one module-level logger and reuse it:

```ts
import { createModuleLogger } from '../logging/logger';

const log = createModuleLogger('settings');

log.info('Loaded settings screen');
log.warn('Theme preference was invalid', { themeMode });
```

Adjust the relative import path to match the file location.

Use `appLogger` only when a namespace does not add useful context.

If a module repeats the same message and level, bind that once and reuse it:

```ts
import {
  createModuleLogger,
  createStructuredLog,
} from '../logging/logger';

const log = createModuleLogger('local-settings-store');
const logLocalSettingsMutation = createStructuredLog(
  log,
  'debug',
  'Local settings mutation committed',
);

logLocalSettingsMutation({
  action: 'setThemeMode',
  themeMode,
});
```

Prefer this pattern for store mutations, rehydrate outcomes, and other structured events that share a fixed message.

## Namespace guidance

- Use short, stable namespaces such as `settings`, `theme`, `store`, or `parent-unlock`.
- Prefer one namespace per file or module area.
- Keep namespace strings sanitized before passing them to `createModuleLogger(...)`.
- Reuse the same namespace for related logs so filtering stays predictable.

## Production guidance

- Assume `info`, `warn`, and `error` logs may be visible in production.
- Reserve `info` for important lifecycle, state, or recovery signals that are worth retrieving later.
- Use `debug` for local development detail that is safe to omit in production.
- Prefer storing useful context in the detail object instead of encoding it into the message string.
- Never log secrets, tokens, passwords, or sensitive personal data.

## Store guidance

- Successful store mutations should usually log at `debug`.
- Rejected store mutations should usually log at `error`.
- Shared transactions and user-journey events should usually log at `info`.
- When multiple actions in one store use the same message prefix, prefer a structured helper created once at module scope.

## React guidance

- Do not log during render.
- Put logs in event handlers, Effects, store actions, async workflows, or error paths.
- Keep high-frequency paths quiet to avoid noisy logs and performance overhead.

## Avoid

- Calling `console.log(...)` directly for normal app logging.
- Creating ad hoc logger instances outside `src/logging/logger.ts`.
- Repeating the same fixed message and level inline across many store actions when `createStructuredLog(...)` would do.
- Using logs as control flow.
- Logging the same event repeatedly from hot render or subscription paths.
- Calling `patchConsole()` unless there is a specific, reviewed reason to reroute global console behavior.

## Practical rule for this repo

- Default to `createModuleLogger(...)` at module scope for new app code that needs logging.
- Use `createStructuredLog(...)` when a module repeats the same message/level combination.
- Use `appLogger` sparingly for truly global logging.
- If a log would be noisy, sensitive, or only useful during local debugging, prefer `debug` or remove it before shipping.
