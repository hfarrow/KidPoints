# State And Stores

This note documents the preferred Zustand store patterns for KidPoints.

## Goals

- Keep store state centralized, predictable, and easy to test.
- Separate store creation from React provider wiring.
- Make persistence and rehydration behavior explicit.
- Keep store logging structured and consistent.

## Current pattern

The main examples live in:

- `src/state/localSettingsStore.tsx`
- `src/state/sessionUiStore.tsx`
- `src/state/sharedStore.tsx`

The usual structure is:

1. Define a store state type with plain data and command-style actions.
2. Export a `create...Store(...)` function that builds a vanilla Zustand store.
3. Wrap it in a React provider with a `useRef(...)`-backed singleton.
4. Export a selector-based hook like `useLocalSettingsStore(...)`.

## Preferred implementation pattern

When adding a new persisted store:

1. Build it with `createStore(...)` and `persist(...)`.
2. Keep persistence config close to the store definition.
3. Use `createJSONStorage(...)` and pass storage in as a dependency when practical.
4. Handle invalid persisted data explicitly in `merge` or `onRehydrateStorage`.
5. Log successful mutations, rejected mutations, and rehydrate outcomes through the shared logger helpers.

When adding a non-persisted store:

1. Keep the same command-style action shape.
2. Still prefer a provider + selector hook if React code consumes it broadly.
3. Use module-scope helpers for repeated structured log messages.

## Store API guidance

- Prefer command-style actions such as `setThemeMode`, `lockParentMode`, or `restoreTransaction`.
- Return explicit command results for business operations when callers need success/error handling.
- Keep actions synchronous when possible; keep async orchestration outside the store unless state ownership clearly belongs there.
- Avoid exposing raw setters that make invalid states easy to create.

## Persistence guidance

- Persist only the minimal state that needs to survive app restarts.
- Keep transient UI state out of persisted payloads unless there is a strong product reason.
- Validate rehydrated state and fall back safely when persisted data is missing or invalid.
- Prefer `partialize(...)` to make persisted fields explicit.

## Logging guidance

- Successful store mutations should usually log at `debug`.
- Rejected store mutations should usually log at `error`.
- Important rehydrate and recovery events should usually log at `info`.
- Prefer `createStructuredLog(...)` when many store actions share the same fixed message.

## React integration guidance

- Do not create a fresh store instance on every render.
- Use `useRef(...)` in providers so each provider owns one stable store instance.
- Keep selector hooks narrow so components subscribe only to the fields they need.
- Throw a clear error if a selector hook is used outside its provider.

## Avoid

- Creating stores directly inside render without `useRef(...)`.
- Persisting whole store objects when only a few fields need to survive.
- Mutating store snapshots in place.
- Mixing navigation side effects directly into generic store setters unless the store exists specifically for navigation orchestration.

## Practical rule for this repo

- New shared state should usually follow the same shape as the existing Zustand stores: `create...Store(...)`, provider, selector hook, explicit persistence, and structured logging.
