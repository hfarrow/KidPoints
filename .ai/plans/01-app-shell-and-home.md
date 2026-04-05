# Plan: Initial App Shell and Home Dashboard

## Summary

Create the first plan file as `.ai/plans/01-app-shell-and-home.md`.

This phase establishes the app shell for a shared-family Expo app with three bottom tabs: `Home`, `Alarm`, and `Shop`. The `Home` tab is the main live dashboard. It shows the shared interval timer plus one widget per child for point totals. Parent mode is gated by a simple PIN and unlocks child-management and point-adjustment controls on the Home tab. The app is local-first for the first prototype, but its data layer should be structured so parent-device sync can be added later without rewriting the UI.

## Key Changes

### App shell and navigation

- Use a tab-based app shell with exactly three primary tabs: `Home`, `Alarm`, and `Shop`.
- Make `Home` the default launch tab.
- Keep Parent mode out of the tab bar; treat it as a gated session/state that affects available actions inside existing screens.
- Build the scaffold so additional tabs or tiles can be added later without redesigning the root layout.
- Add placeholder `Alarm` and `Shop` screens in this phase so navigation is real, even if their full feature sets are deferred.

### Architecture and state model

- Introduce a `src/` app structure with clear separation between UI, domain models, and persistence.
- Define app-level models for:
  - `ChildProfile`: id, displayName, points, sortOrder, optional avatar/photo placeholder, active/inactive flag if needed later
  - `SharedTimerConfig`: intervalMinutes, notification settings placeholder, sound placeholder, alarm duration placeholder
  - `SharedTimerState`: current cycle start time, next alarm time, running/paused state
  - `ParentSession`: locked/unlocked state and PIN verification state
- Use a repository/service boundary so the first implementation persists locally, but callers do not depend directly on storage details.
- Persist data locally across app restarts; do not add cloud sync in this phase.
- Reserve interfaces for future shop catalog, cart, and sync support, but do not implement those workflows yet.

### Home tab behavior

- Treat the Home tab as a tile/dashboard screen, not a plain launcher.
- Include a shared timer tile showing:
  - current interval status
  - time remaining or next trigger time
- clear visual "running vs paused" state
- Include one child tile per child showing:
  - child name
  - current point total
  - simple visual identity area for future avatar/photo use
- In normal mode, child tiles are read-only status widgets.
- In Parent mode, each child tile exposes admin actions to:
  - increment points
  - decrement points
  - set points to an exact value
- In Parent mode, Home also exposes child-management actions to:
  - add a child
  - remove a child
  - reorder child widgets
  - enter per-child configuration later
- Keep Home extensible so new tiles can be added later without restructuring the screen.

### Parent mode

- Protect Parent mode with a simple numeric PIN.
- Unlocking Parent mode should affect the current session only; re-entry rules can be simple for v1.
- Parent mode should visibly change the Home screen so admin controls are clearly available.
- Parent mode scaffolding must be reusable later by Alarm settings and Shop admin workflows.

## Public Interfaces and Data Decisions

- Root navigation contract:
  - `Home`
  - `Alarm`
  - `Shop`
- Initial home-dashboard tile types:
  - shared timer tile
  - child point tile
  - add-child/admin tile visible only in Parent mode
- Initial persistence contract should support local implementations now and remote sync implementations later.
- No dedicated "Counter" tab in this phase; point tracking lives on the Home dashboard through child widgets.

## Test Plan

- App launches into the `Home` tab.
- Bottom tabs navigate correctly between `Home`, `Alarm`, and `Shop`.
- Home renders a shared timer tile plus one tile per stored child.
- Child point totals persist after app restart.
- Parent mode stays locked by default.
- Correct PIN unlocks Parent mode; incorrect PIN does not.
- Parent-only controls are hidden while locked and visible while unlocked.
- Parent can add a child and the new child tile appears immediately.
- Parent can reorder or remove child widgets and the order persists.
- Parent can increment, decrement, and set points from the child tile controls.
- Shared timer state and configuration persist locally across app restarts.

## Assumptions and Defaults

- First prototype is local-first and offline-capable on a shared family device, but the architecture must be cloud-ready for future parent-device sync.
- The earning timer is one shared family timer, not one timer per child.
- The Home screen is a live dashboard with tile widgets, not just a static menu.
- `Alarm` and `Shop` are real tabs now, but their deeper requirements will be planned in later `.ai/plans/*.md` files.
- Parent mode governs admin actions across the app, starting with Home and expanding later.
- Store item management is not implemented in this first plan, but the parent-mode architecture must leave room for it.
