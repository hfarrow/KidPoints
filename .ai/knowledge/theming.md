# Theming

This note documents the preferred theming approach for KidPoints.

## Goals

- Keep theme decisions centralized in semantic tokens.
- Avoid scattering raw color values across screens and components.
- Make it easy to iterate on one UI surface first, then expand safely.
- Keep parent mode separate from global theme mode.

## Current model

- Persist the user theme preference as `light`, `dark`, or `system`.
- Resolve `system` at runtime from the device color scheme.
- Expose the active theme through the shared theme context in `src/features/theme/`.
- Keep parent mode as a contextual surface variant, not as a separate theme.

## Preferred implementation pattern

When a component needs theme-aware styles:

1. Read theme data through `useAppTheme()` when you need values or actions such as `themeMode`, `setThemeMode`, or `getScreenSurface`.
2. Prefer `useThemedStyles(...)` for component styling so tokens flow into `StyleSheet.create(...)`.
3. Use semantic tokens like `textPrimary`, `textMuted`, `controlSurface`, `border`, and `modalSurface` instead of hardcoded hex values.

Example pattern:

```ts
const styles = useThemedStyles(({ tokens }) =>
  StyleSheet.create({
    title: {
      color: tokens.textPrimary,
    },
  }),
);
```

## Avoid

- Inline raw hex colors in component render code.
- Ad hoc dark-mode branches spread across screens.
- Treating parent mode colors as replacements for the global light/dark palette.
- Re-theming the whole app in one pass before validating the UX on a focused surface.

## Rollout guidance

- Start by applying theme changes to one UI surface or shared component cluster.
- Validate contrast, tone, and ergonomics there first.
- Expand only after the token names and visual direction feel stable.

## Token guidance

Prefer semantic names over usage-specific names.

- Good: `textPrimary`, `modalSurface`, `controlText`, `tabBarBackground`
- Avoid: `blueText`, `cardWhite`, `grayBorder2`

Tokens should describe intent, not literal appearance.

## Practical rule for this repo

- If a component is theme-aware, first ask whether its styling belongs in a themed style factory.
- Default to `useThemedStyles(...)` for reusable components and shared UI.
- Use inline theme values only when a truly dynamic value depends on runtime state that does not fit cleanly in a style factory.
