# Sync And Simulation

This note documents the preferred architecture and maintenance expectations for the NFC-bootstrapped nearby sync flow and the in-app sync testbed.

## Goals

- Keep the real sync workflow and the simulator-driven testbed aligned.
- Make sync UI iteration possible from one device without introducing fake UI-only state paths.
- Preserve a clean runtime seam so the session hook can run against either the native modules or the TypeScript simulator.
- Keep NFC bootstrap behavior, hidden role assignment, and bootstrap-bound nearby transport parity aligned between production and the simulator.

## Current pattern

The main examples live in:

- `src/features/sync/useNearbySyncSession.ts`
- `src/features/sync/nearbySyncRuntime.ts`
- `src/features/sync/nfcSyncBridge.ts`
- `src/features/sync/syncRuntimeContext.tsx`
- `src/features/sync/syncSimulatorRuntime.ts`
- `src/features/sync/syncTestbedFixtures.ts`
- `src/features/sync/SyncTestbedScreen.tsx`
- `src/features/sync/SyncScreenContent.tsx`
- `modules/nfc-sync/`
- `app/sync-testbed.tsx`

## Runtime seam guidance

- Keep `useNearbySyncSession(...)` as the main orchestration hook.
- Route all native or simulated NFC bootstrap and nearby transport behavior through `NearbySyncRuntime`.
- Prefer adding new runtime capabilities to the runtime interface and both adapters rather than importing the native bridge directly into session logic.
- Treat the native runtime and simulator runtime as peers that should emit the same event shapes and support the same high-level workflow.
- Treat NFC bootstrap availability, state changes, completion events, and native logs as first-class runtime concerns, not side channels.
- Keep the production flow one-button from the session hook's point of view: readiness checks, NFC bootstrap, hidden role assignment, nearby connection, then review and confirm.

## Testbed guidance

- Treat `/sync-testbed` as a maintained runtime feature, not throwaway debug code.
- Prefer embedding shared sync UI content inside the testbed rather than building test-only copies of tiles, modals, or review screens.
- Prefer sandboxed providers and stores inside the testbed when a scenario needs isolated state that must not mutate the user's real app data.
- Keep testbed controls focused on simulator state, fixture strategy, scenario playback, and inspection tools.
- Keep the testbed aligned with the production UX. If the product hides host/join concepts behind NFC bootstrap, the default testbed UI should hide them too.
- If internal host/join control is still useful for debugging, prefer keeping it as an internal simulator detail or an explicit debug-only affordance rather than a primary testbed control.

## Fixture and simulator guidance

- Prefer realistic simulator behavior that drives the real session hook and protocol flow, not direct UI state mutation.
- Keep fixture strategies explicit when lineage matters, such as:
  - left bootstrap
  - right bootstrap
  - shared base
  - independent lineages
- Model the NFC bootstrap stage in the simulator, including readiness failures and bootstrap progress, before nearby transport begins.
- Keep hidden role assignment deterministic in the simulator. Prefer deriving the simulated host/join branch from fixture strategy or scenario setup instead of exposing user-facing role toggles.
- When the production flow changes NFC bootstrap state names, timeout handling, session-binding rules, or bootstrap-token validation, update the simulator and `/sync-testbed` in the same change whenever practical.
- Prefer simulator scenarios that cover NFC-specific failures, such as:
  - NFC unsupported
  - NFC disabled or unavailable
  - bootstrap timeout
  - wrong peer or bootstrap token mismatch
- When a sync change affects protocol messages, merge preparation, history export/import, commit behavior, or error handling, review whether `syncSimulatorRuntime.ts`, `syncTestbedFixtures.ts`, and `/sync-testbed` need corresponding changes.
- When a sync change adds or changes a state in the real flow, make sure the simulator can still reach and demonstrate that state.
- Prefer adding or updating simulator tests alongside real sync behavior changes so parity regressions are caught quickly.

## UI reuse guidance

- Prefer thin route wrappers plus shared content components for sync-related screens that need to render both in production routes and inside the testbed.
- Reuse embeddable screen content for adjacent inspection tools, such as rendering transaction history inside the sync testbed sandbox.
- Keep route-specific shell concerns, such as headers or back footers, separate from reusable content whenever the testbed needs to embed the feature body directly.

## Practical rule for this repo

- If you change the real NFC bootstrap or nearby sync process, assume the simulator and testbed probably need an update too, and verify that the testbed can still exercise the important happy-path and failure states after your change.
