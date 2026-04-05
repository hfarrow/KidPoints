# Plan: TypeScript, Jest, ESLint, and Biome Tooling

## Summary

Add a tooling plan as `.ai/plans/02-tooling-testing-and-typescript.md`.

This phase converts the app to TypeScript-first development, adds Jest testing for Expo/React Native, and introduces overlapping ESLint and Biome usage with clear responsibility boundaries. The script model becomes:

- `check`: run Biome auto-fixes, ESLint auto-fixes with caching, and TypeScript type-checking with incremental caching
- `test`: run Jest
- `verify`: run `check` and then `test`
- `clean:cache`: remove ESLint and TypeScript cache artifacts

## Key Changes

### TypeScript foundation

- Convert the authored app codebase to TypeScript now, starting with the current root app code and any new `src/` modules.
- Add `tsconfig.json` using Expo's TypeScript base config with strict mode enabled.
- Treat TypeScript as the default path for all new app code; keep JavaScript only where Expo tooling requires it.
- Make type-checking part of `check` instead of a separate primary workflow, using `tsc --noEmit --incremental`.

### ESLint and Biome responsibilities

- Use Biome for formatting, import organization, and fast broad code-quality cleanup.
- Use ESLint for React, React Native, Expo, and framework-aware correctness rules.
- Configure ESLint to avoid fighting Biome on formatting concerns.
- Base ESLint on Expo-compatible config, then add only the minimum overrides needed for TS and Biome coexistence.
- Add a Biome config that covers TS, TSX, JS, JSON, and project config files.

### Caching and cleanup

- Store cache artifacts in a dedicated root `.cache/` directory.
- Configure ESLint with `--cache` and a cache location under `.cache/`.
- Configure TypeScript incremental checking with a dedicated `.tsbuildinfo` file under `.cache/`.
- Add `.cache/` to `.gitignore` so tooling artifacts never show up in commits.
- Add a cleanup script, recommended name `clean:cache`, that deletes the ESLint cache file and TypeScript build info output under `.cache/`.

### Jest and baseline testing

- Use `jest-expo` so the test environment matches Expo expectations.
- Add React Native testing-library support for component rendering.
- Add one starter smoke test that renders the root app and checks for a stable visible element.
- Add a Jest setup file only if required for matchers or environment setup.

### Package scripts

- `check`: run Biome with `--write`, then ESLint with `--fix --cache`, then `tsc --noEmit --incremental`
- `test`: run Jest once in non-watch mode
- `verify`: run `check` and then `test`
- `clean:cache`: remove `.cache/` or the specific cache files within it

## Public Interfaces and Config Surface

- `package.json` scripts:
  - `check`
  - `test`
  - `verify`
  - `clean:cache`
- New config surface:
  - `tsconfig.json`
  - ESLint config file
  - Biome config file
  - Jest config or equivalent Expo-compatible setup
  - optional Jest setup file
- New ignored artifact path:
  - `.cache/`

## Test Plan

- `yarn check` successfully runs Biome fixes, ESLint fixes with cache enabled, and TypeScript type-checking with incremental output.
- `yarn test` runs the initial Jest smoke test successfully.
- `yarn verify` runs checks first and tests second, failing on any step.
- `yarn clean:cache` removes the created cache artifacts under `.cache/`.
- `.cache/` is ignored by Git and does not appear in normal status output after checks.
- The app still starts normally after the JavaScript-to-TypeScript conversion.

## Assumptions and Defaults

- TypeScript should be strict from the start.
- `check` is intentionally mutating because it includes Biome and ESLint auto-fix behavior.
- Type-checking belongs inside `check`, not as a separate main script.
- Cache artifacts should be centralized in `.cache/` rather than using scattered tool defaults.
- The initial Jest goal is proving the toolchain and root app render path, not broad feature coverage.
