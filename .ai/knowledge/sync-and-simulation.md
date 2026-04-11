# Sync And Simulation

This note documents the preferred architecture and maintenance expectations for nearby sync and the in-app sync testbed.

## Goals

- Keep the real sync workflow and the simulator-driven testbed aligned.
- Make sync UI iteration possible from one device without introducing fake UI-only state paths.
- Preserve a clean runtime seam so the session hook can run against either the native module or the TypeScript simulator.

## Current pattern

The main examples live in:

- `src/features/sync/useNearbySyncSession.ts`
- `src/features/sync/nearbySyncRuntime.ts`
- `src/features/sync/syncRuntimeContext.tsx`
- `src/features/sync/syncSimulatorRuntime.ts`
- `src/features/sync/syncTestbedFixtures.ts`
- `src/features/sync/SyncTestbedScreen.tsx`
- `src/features/sync/SyncScreenContent.tsx`
- `app/sync-testbed.tsx`

## Runtime seam guidance

- Keep `useNearbySyncSession(...)` as the main orchestration hook.
- Route all native or simulated transport behavior through `NearbySyncRuntime`.
- Prefer adding new runtime capabilities to the runtime interface and both adapters rather than importing the native bridge directly into session logic.
- Treat the native runtime and simulator runtime as peers that should emit the same event shapes and support the same high-level workflow.

## Testbed guidance

- Treat `/sync-testbed` as a maintained runtime feature, not throwaway debug code.
- Prefer embedding shared sync UI content inside the testbed rather than building test-only copies of tiles, modals, or review screens.
- Prefer sandboxed providers and stores inside the testbed when a scenario needs isolated state that must not mutate the user's real app data.
- Keep testbed controls focused on simulator state, fixture strategy, scenario playback, and inspection tools.

## Fixture and simulator guidance

- Prefer realistic simulator behavior that drives the real session hook and protocol flow, not direct UI state mutation.
- Keep fixture strategies explicit when lineage matters, such as:
  - left bootstrap
  - right bootstrap
  - shared base
  - independent lineages
- When a sync change affects protocol messages, merge preparation, history export/import, commit behavior, or error handling, review whether `syncSimulatorRuntime.ts`, `syncTestbedFixtures.ts`, and `/sync-testbed` need corresponding changes.
- When a sync change adds or changes a state in the real flow, make sure the simulator can still reach and demonstrate that state.
- Prefer adding or updating simulator tests alongside real sync behavior changes so parity regressions are caught quickly.

## UI reuse guidance

- Prefer thin route wrappers plus shared content components for sync-related screens that need to render both in production routes and inside the testbed.
- Reuse embeddable screen content for adjacent inspection tools, such as rendering transaction history inside the sync testbed sandbox.
- Keep route-specific shell concerns, such as headers or back footers, separate from reusable content whenever the testbed needs to embed the feature body directly.

## Practical rule for this repo

- If you change the real nearby sync process, assume the simulator and testbed probably need an update too, and verify that the testbed can still exercise the important happy-path and failure states after your change.
