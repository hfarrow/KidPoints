# UI Composition

This note documents the preferred screen and shared-component composition patterns for KidPoints.

## Goals

- Build screens from a small set of shared primitives.
- Keep layouts visually consistent without making them feel generic.
- Reuse the same interaction surfaces so logging, theming, and accessibility stay aligned.
- Make new screens easy to scaffold from existing examples.

## Current pattern

The main examples live in:

- `src/components/ScreenScaffold.tsx`
- `src/components/ScreenHeader.tsx`
- `src/components/Tile.tsx`
- `src/components/Skeleton.tsx`
- `src/components/MainScreenActions.tsx`
- `src/components/LoggedPressable.tsx`

## Preferred screen structure

Most screens should follow this rough shape:

1. `ScreenScaffold` for safe area, scrolling, and shared background behavior.
2. `ScreenHeader` when the screen needs a title or leading action.
3. One or more `Tile` sections for grouped content.
4. `ActionPill`, `ActionPillRow`, and `StatusBadge` for compact actions and status treatment.

## Component guidance

- Prefer `Tile` for grouped feature sections instead of ad hoc card containers.
- Prefer `ActionPill` for compact secondary and primary actions inside a tile.
- Prefer `StatusBadge` for short state labels such as `Locked`, `Unlocked`, `HEAD`, or active theme values.
- Prefer `LoggedPressable` over raw `Pressable` for app-level interactions so debug press logs stay consistent.

## Interaction guidance

- Keep one clear interaction primitive per use case rather than inventing new button treatments per screen.
- Pass useful `logLabel` and `logContext` into `LoggedPressable` when the interaction matters diagnostically.
- Use collapsible `Tile` sections when a grouped block benefits from being expandable instead of building custom disclosure UI.

## Layout guidance

- Prefer small vertical stacks of tiles over deeply nested container trees.
- Keep action groups visually compact with `ActionPillRow`.
- Use themed shared components before reaching for one-off styling.
- Let semantic status and hierarchy come from the existing primitives before adding new ornamentation.

## Accessibility guidance

- Provide accessible labels for icon-only press targets.
- Use selected state for option pickers when a value is currently active.
- Keep interaction targets large enough for touch and consistent with the shared components.

## Avoid

- Building new screen containers when `ScreenScaffold` or `Tile` already fits.
- Reintroducing raw `Pressable` for normal app interactions when `LoggedPressable` is appropriate.
- Creating slightly different local versions of pills, badges, or section cards without a real product need.
- Mixing unrelated layout idioms on adjacent screens when the shared primitives already cover them.

## Practical rule for this repo

- Default to composing screens from the shared primitives first; only introduce a new UI pattern when the existing building blocks clearly do not fit.
