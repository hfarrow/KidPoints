# AGENTS.md

This repository keeps local implementation guidance in `.ai/knowledge/`.

Use these notes as project references before generating or changing code:

- Directory reference: `.ai/knowledge/`
- React code reference: `.ai/knowledge/rules-of-react.md`
- Theming reference: `.ai/knowledge/theming.md`

When generating React or React Native code for this repo:

- Follow the React rules summarized in `.ai/knowledge/rules-of-react.md`.
- Follow the theming guidance in `.ai/knowledge/theming.md` for theme-aware UI.
- Prefer idiomatic React patterns over clever shortcuts.
- Keep components and Hooks pure, and keep side effects out of render.
- Follow the Rules of Hooks consistently.

Workflow rules for this repo:

- Always run `yarn check` after code changes.
- Always run `yarn test` after completing testable features.
- Always add tests for new functionality.
- Before a commit, prefer running `yarn clean:cache` and then `yarn verify`.
