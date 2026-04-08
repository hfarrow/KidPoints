# Navigation And Modals

This note documents the preferred navigation patterns for KidPoints.

## Goals

- Keep route changes predictable and easy to reconstruct from logs.
- Treat guarded flows and startup redirects as explicit app behavior.
- Keep modal routes consistent with the root navigator.
- Avoid scattering ad hoc navigation decisions across unrelated components.

## Current pattern

The main examples live in:

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/settings.tsx`
- `app/list-browser.tsx`
- `app/transactions.tsx`
- `src/navigation/StartupNavigationCoordinator.tsx`
- `src/navigation/startupNavigationStore.ts`
- `src/features/overlays/TextInputModal.tsx`
- `src/features/overlays/textInputModalStore.ts`
- `src/features/parent/ParentUnlockModal.tsx`

## Route guidance

- Keep the tab navigator limited to persistent top-level destinations such as Home, Alarm, and Shop.
- Prefer root stack routes for detail or support screens such as Settings, archived item browsers, and transaction history when back navigation should return to the opener.
- Do not hide support screens inside the tab navigator just to preserve the tab bar. That changes back behavior from stack history to tab history.
- If a non-tab screen must keep the tab bar visible, use a stack nested inside the active tab or a shared-route tab-group design intentionally rather than hidden tab routes.
- When a root stack screen replaces the tab bar, it is acceptable to add an explicit in-screen back affordance, including a footer action that fills the vacated bottom-bar space.
- Register modal-style routes in the root stack with explicit `presentation` options.
- Use route-level logging for major navigation events such as initial route entry, transitions, modal open, and modal close.
- Keep pathnames and segment paths in navigation logs so user flow can be reconstructed later.

## Modal guidance

- Prefer route-backed modals for guarded or navigation-significant overlays.
- Prefer a local modal host for transient input, picker, or confirm overlays that do not need their own route history entry.
- Keep modal state and modal navigation responsibilities separated.
- Use store state for modal request data when a shared modal experience is opened from multiple screens.
- Close or redirect modals intentionally rather than relying on incidental back behavior.

## Guarded flow guidance

- When a flow requires parent unlock or setup, treat that as an explicit navigation step.
- Prefer queueing or coordinating startup navigation through dedicated navigation state instead of firing blind `router.push(...)` calls during initialization.
- Keep startup or gate-driven navigation idempotent so repeated effects do not stack duplicate pushes.

## Component guidance

- Use `useRouter()` close to the component that owns the user action or flow decision.
- Keep basic user-intent navigation in event handlers.
- Keep more complex startup or recovery navigation in a dedicated coordinator module.
- Prefer clear `href` strings and stable request ids for queued navigation work.

## Logging guidance

- Route transitions and important modal events should usually log at `info`.
- User-intent button presses can log at `debug` through `LoggedPressable`.
- Startup navigation scheduling, dispatch, completion, and cancellation should be logged with enough metadata to diagnose why a route change happened.

## Avoid

- Triggering navigation during render.
- Spreading the same guarded navigation rule across many screens when one coordinator or helper could own it.
- Mixing transient modal form state into route params when a local store is a better fit.
- Adding one-off modal presentation styles without updating the root stack.

## Practical rule for this repo

- Keep simple screen navigation in handlers, but centralize startup, guarded, and modal orchestration so routes, logs, and behavior stay consistent.
- Treat tabs as durable app sections and stacks as the place for push/pop history.
