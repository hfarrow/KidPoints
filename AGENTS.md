# AGENTS.md

This repository keeps local implementation guidance in `.ai/knowledge/`.

Use these notes as project references before generating or changing code:

- Directory reference: `.ai/knowledge/`
- React code reference: `.ai/knowledge/rules-of-react.md`
- State/store reference: `.ai/knowledge/state-and-stores.md`
- Navigation reference: `.ai/knowledge/navigation-and-modals.md`
- Theming reference: `.ai/knowledge/theming.md`
- UI composition reference: `.ai/knowledge/ui-composition.md`
- Logging reference: `.ai/knowledge/logging.md`

When generating React or React Native code for this repo:

- Follow the React rules summarized in `.ai/knowledge/rules-of-react.md`.
- Follow the store guidance in `.ai/knowledge/state-and-stores.md` for Zustand state, providers, persistence, and store logging.
- Follow the navigation guidance in `.ai/knowledge/navigation-and-modals.md` for route transitions, startup redirects, and modal flows.
- Keep the tab navigator focused on persistent top-level destinations. Prefer stack routes for detail or support screens unless a tab-local stack/shared-route design is intentionally chosen to keep the tab bar visible.
- Follow the theming guidance in `.ai/knowledge/theming.md` for theme-aware UI.
- Follow the UI composition guidance in `.ai/knowledge/ui-composition.md` for screens, tiles, action rows, badges, and logged interactions.
- Follow the logging guidance in `.ai/knowledge/logging.md` for app and module logging.
- Prefer the shared logging helpers in `src/logging/logger.ts` over repeating fixed log messages and levels inline.
- Prefer idiomatic React patterns over clever shortcuts.
- Keep components and Hooks pure, and keep side effects out of render.
- Follow the Rules of Hooks consistently.

Workflow rules for this repo:

- Always run `yarn check` after code changes for frequent incremental validation.
- If `yarn check` fails with fixable Biome or ESLint issues, run `yarn check-fix` and then re-read any files that were modified by those fixes before continuing.
- Always run `yarn test` after completing testable features.
- Always add tests for new functionality.
- Before a commit, prefer running `yarn clean:cache` and then `yarn verify`.
