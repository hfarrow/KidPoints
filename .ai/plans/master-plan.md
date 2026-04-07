# KidPoints Master Plan

## Part 1: Product Purpose And UI Shape

This document is the long-lived planning reference for KidPoints. It should
capture the product direction and shared UI shape in durable language that can
support future feature planning without locking us into specific
implementations.

This first section is intentionally abstract. It should preserve the current
app feel and layout patterns while avoiding code-level details, storage design,
or technical implementation requirements.

### What KidPoints Is

KidPoints is a shared family dashboard for tracking points earned by one or
more kids.

Points are primarily earned through recurring timer-based check-ins. The app
also allows points to be adjusted manually from the main dashboard when needed.

The product is designed for two complementary use cases:

- fast day-to-day interaction
- parent-controlled management and review

The Shop remains part of the core product shape even while it is still light in
this phase. It represents the future rewards loop and should continue to feel
like a real destination in the app.

### General Design Ideology

- Prefer compact layouts that present critical information in as few visual rows
  as possible.
- Treat density as a strength, especially on dashboard-style screens.
- Use expansion and collapse to reveal secondary details or controls instead of
  giving them permanent space.
- Keep padding, margins, and decorative whitespace intentionally tight while
  still preserving readability and touch comfort.
- Prefer a clean, calm interface without distracting ornaments or unnecessary
  visual noise.
- Use iconography where it is practical and widely understandable, especially
  for universal actions such as settings, arrows, add, remove, and navigation.
- Keep this design ideology short and durable so future planning can extend it
  over time without rewriting the full master plan.

### Shared UI Language

The app is organized around a bottom tab bar with three primary destinations:
Home, Alarm, and Shop.

Each main screen should follow the same broad shell:

- a prominent screen title
- a horizontal area for quick controls and shared actions
- a vertical stack of tiles that carry the main content of the screen

Tiles are the core design construct of the app. They should act as the default
container for grouped information, status, controls, and actions. Individual
tiles may vary in density and behavior, but they should still feel like one
family of surfaces.

The app should continue to feel:

- compact
- dashboard-like
- tactile
- easy to scan at a glance
- visually consistent across tabs

Parent Mode is a shared app state that changes which controls are visible or
interactive, but it is not a separate screen or separate visual theme.

### Shared Supporting Surfaces

In addition to the three main tabs, the app uses a small set of supporting
surfaces that appear across the experience:

- a settings surface for shared app preferences
- a parent unlock prompt
- lightweight list-based overlays for focused browsing tasks
- small add or edit dialogs for targeted changes

These supporting surfaces should feel short, contained, and closely related to
the main dashboard screens. They support the primary tile-based workflow rather
than replacing it.

They should reuse the same general visual language as the main app shell:
strong titles, compact spacing, clear actions, and calm presentation.

### Screen Shapes

#### Home

Home is the primary dashboard and the most frequently used screen in the app.

It should open with the shared screen shell and place a compact timer or alarm
summary tile near the top. Below that, the main body should be a list of child
tiles, with one tile per child.

Each child tile should emphasize:

- the child identity
- the current point total
- quick point adjustment actions

Deeper child management should be available through a secondary settings or
edit state rather than crowding the default tile view.

When there are no children yet, Home should show a friendly empty-state tile
instead of a blank space.

When Parent Mode is available, Home should also include a dedicated parent
tools tile for management actions such as adding children or opening secondary
management flows.

Supporting overlays launched from Home may include:

- adding a child
- editing an exact point total
- browsing archived children

#### Alarm

Alarm is the operational screen for the timer and check-in system.

It should keep the same overall shell as Home, but focus on fewer,
utility-oriented tiles.

The screen should include three major tile groups:

- a timer summary tile with start, pause, and reset controls
- a settings tile for interval and duration values
- a notification and status tile for readiness, system state, and corrective
  actions

Alarm is more parent-oriented and more configuration-heavy than the other main
tabs, but it should still feel visually aligned with the rest of the app.

#### Shop

Shop is a real destination in the tab bar even while it remains intentionally
lightweight in this phase.

It should preserve the same shell and tile rhythm as the rest of the app.

At this stage, Shop should generally include:

- a tile that communicates the shop is still in a prototype phase
- a tile that summarizes what shop-related groundwork already exists or what
  the future shop will connect to

Shop should remain visible as a stable placeholder so the rewards loop stays
part of the product story without forcing premature detail into early planning.

### Terminology And Boundaries

This first master-plan section should stay focused on product purpose and UI
shape.

Use stable product terms such as:

- child
- points
- check-in
- Parent Mode
- tile
- tab

Avoid embedding code concepts, storage design, event flow details, or
implementation-specific naming in this section.

Secondary flows such as history or transaction detail views may be added in
later planning sections, but they should not be deeply specified here.

## Part 2: Tech Stack And Architecture

This section defines the architectural rules that should guide implementation
across the app. It is intended to be durable enough to survive refactors while
still being concrete enough that future feature plans inherit the same
technical assumptions.

### Guiding Technical Principles

- Build the MVP as a local-first app, but keep the architecture ready for sync.
- Favor deterministic state evolution so the same inputs always produce the
  same resulting shared state.
- Treat all critical shared mutations as auditable and reversible.
- Keep `_layout` files small and focused on composition, not business logic.
- Keep shared domain and orchestration logic outside render trees.
- Reuse and simplify the reference theming model rather than growing a large,
  fragmented token and color system.

### Core Stack And Boundaries

Expo, React Native, and Expo Router remain the application foundation.
TypeScript remains required.

Zustand is the standard hook-based state management solution for the rebuilt
app.

The architecture should preserve clear boundaries so UI surfaces do not talk
directly to persistence details or native alarm implementation details.

The app architecture should be thought of as four distinct buckets:

- shared syncable domain state
- local persisted display and settings state
- local ephemeral session and UI state
- native runtime and operating-system integration state

### Shared State Model

Critical shared state includes the parts of the app that should eventually
remain consistent across devices. That includes:

- children
- points
- timer and check-in state
- future shop and rewards state

Local-only state includes preferences or values that only control how the app
is displayed on one device, such as theme mode and similar display settings.

For the MVP, Parent Mode PIN is local-device state rather than shared sync
state. It can begin as a hardcoded default PIN of `0000`. In development mode,
Parent Mode may default to unlocked for convenience.

Shared state should be persisted in two complementary forms:

- a materialized current head for fast startup and rendering
- an append-only shared event log for audit, restore, replay, and future sync

Raw shared events remain durable. The app may locally derive grouped
transaction rows or restore points for presentation, but that grouping should
not replace the underlying event fidelity.

Restoring to a prior point should create a new shared restore event rather than
rewriting or deleting history.

Repeated sequential actions of the same kind, such as many consecutive point
taps, may be grouped into a single derived transaction row so long as the
authoritative shared event model remains intact.

The same underlying shared state model should support three phases of sync:

- local-only operation
- direct device-to-device exchange
- cloud-backed sync

### Deterministic Merge And Sync Direction

When devices eventually sync divergent timelines, canonical merge order should
be based on stable device identity plus monotonic per-device sequencing.

Timestamps are metadata and useful for display, but they are not the authority
for canonical ordering.

The architecture should assume that replaying the same merged shared event set
must always yield the same end state on every device.

This chapter intentionally locks the deterministic baseline only. Domain-
specific merge rules for harder conflict cases can be planned later in a
dedicated sync-focused chapter.

### Store And Service Architecture

The rebuilt app should not rely on a single giant context that owns every
concern.

Instead, architecture should separate responsibilities clearly:

- the shared Zustand store owns the shared document, projections, selectors,
  and domain commands
- the local settings store owns display-only preferences such as theme
- local session and runtime UI state owns transient concerns such as unlocked
  Parent Mode sessions and cross-screen ephemeral UI state
- screen-local draft state should stay local unless it truly needs cross-screen
  coordination

Separate services or coordinators should exist for:

- persistence and repository access
- lifecycle coordination
- native alarm bridge integration

UI components should consume focused selectors and targeted hooks rather than a
single broad state surface.

### Lifecycle And Alarm Architecture

The foundation must explicitly distinguish between cold start and resume from
the background.

Lifecycle handling should be treated as a coordinator concern rather than
something screens or render functions casually perform.

The architecture must support at least these entry paths:

- cold app launch
- resume from background
- return from a push or alarm notification while the app is still alive

JavaScript and the shared app state remain authoritative for timer and
check-in-related business state.

The native alarm module should be treated as an execution engine that handles:

- scheduling
- playback and notification behavior
- launch intents
- runtime status reporting

Native integration may report runtime facts and launch actions back to
JavaScript, but it should not become the source of truth for shared business
state.

Detailed cleanup of alarm integration, lifecycle flow, and plugin synchronization
is intentionally deferred to a dedicated sub-plan.

### Theming And Styling Architecture

The rebuilt app should follow the same semantic-token direction as the
reference implementation while simplifying where possible.

Prefer token reuse and shared style patterns over introducing many one-off
colors, parallel style systems, or ad hoc theming branches.

Theme and display preferences remain local-only and are excluded from syncable
critical shared state.

### Architectural Interfaces

Future implementation plans should preserve the role of these architectural
interfaces even if their exact code shape evolves:

- `SharedDocument`: the versioned shared head plus the shared event log
- `SharedEvent`: the append-only record of a critical shared mutation
- `TransactionRow`: a grouped audit and restore presentation derived from raw
  shared events
- `LocalSettings`: local display-only preferences
- `AlarmRuntimeStatus`: native runtime facts exposed to JavaScript
- `LifecyclePhase`: an explicit distinction between cold-start and resume-style
  execution paths

This chapter names the role of these interfaces, not a wire format or field-by-
field schema.

### Architectural Verification

Future implementation work derived from this chapter should verify:

- deterministic replay from the same merged shared event set
- grouped transaction rows still preserve correct restore behavior
- repeated point taps can be grouped without losing authoritative event
  fidelity
- local-only settings such as theme do not leak into shared sync state
- Parent Mode local PIN and session behavior remain separate from shared domain
  state
- cold start and foreground resume trigger the correct coordinator paths
- alarm bridge integration respects JavaScript authority over shared business
  state

### Assumptions And Defaults

Default local persistence remains repository-backed and local-first. The exact
storage backend can stay lightweight until a dedicated storage plan changes it.

Parent Mode should be treated as a product gate for the MVP, not as a shared
cross-device authentication system.

This chapter locks the baseline deterministic ordering model, but defers
domain-specific conflict policy design.

Cloud transport, server shape, and nearby-device sync protocol are all deferred
to later planning. What matters now is that the shared data model is ready for
those later phases.

Detailed alarm flow design, sync conflict matrices, and future PIN
customization UX belong in later sub-plans.
