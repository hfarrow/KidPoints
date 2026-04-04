# Rules of React

Source summarized from the official React reference:
- https://react.dev/reference/rules

This note is a compact local reference for generating React and React Native code in this repository.

## Why these rules matter

React expects components and Hooks to follow a small set of strict rules. Following them keeps rendering predictable, makes bugs easier to catch, and lets React optimize safely.

## 1. Components and Hooks must be pure

Treat rendering as a pure calculation from inputs to UI.

- Components should be idempotent. Given the same props, state, and context for a render, they should produce the same result.
- Do not perform side effects during render. Rendering may happen multiple times, so effects belong in event handlers or Effects.
- Treat props and state as immutable snapshots for the current render. Do not mutate them directly.
- Treat Hook arguments and return values as immutable too. Do not mutate values that were passed into or returned from Hooks.
- Do not mutate values after passing them to JSX. Finish any transformation before creating the JSX tree.

## 2. React calls Components and Hooks

React owns when and how components and Hooks are invoked.

- Do not call component functions directly like normal JavaScript functions. Use components through JSX.
- Do not pass Hooks around as ordinary values or invoke them indirectly. Hooks should stay inside React component or custom Hook execution.

## 3. Rules of Hooks

Hooks are special and must be called in a stable, predictable order.

- Only call Hooks at the top level of a React component or custom Hook.
- Do not call Hooks inside loops, conditions, nested functions, callbacks, or after early returns.
- Only call Hooks from React components or custom Hooks, not from regular utility functions.

## Practical guidance for this repo

When writing React or React Native code here:

- Keep render logic free of network requests, storage writes, timers, logging side effects, and imperative mutations.
- Compute derived values during render, but move state changes and subscriptions into Effects or event handlers.
- Prefer passing new objects or arrays instead of mutating existing ones.
- If logic needs Hooks, move it into a component or a custom Hook.
- If a component seems to require conditional Hook calls, restructure the component so Hook order stays fixed.

## Quick checklist

Before shipping a React change, verify:

- Render output depends only on current props, state, and context.
- No side effects run during render.
- Props, state, Hook inputs, and JSX-bound values are not mutated.
- Components are rendered via JSX, not called directly.
- Hooks are only called at the top level of React components or custom Hooks.
