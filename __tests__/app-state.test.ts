import { describe, expect, it } from '@jest/globals';

import {
  appDataReducer,
  createDefaultAppData,
  DEFAULT_PARENT_PIN,
  verifyParentPin,
} from '../src/features/app/state';
import {
  computeTimerSnapshot,
  formatDuration,
} from '../src/features/app/timer';

describe('appDataReducer', () => {
  it('adds and reorders children while preserving sequential sort order', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    state = appDataReducer(state, { type: 'addChild', name: 'Blake' });
    state = appDataReducer(state, {
      type: 'moveChild',
      childId: state.children[1].id,
      direction: 'up',
    });

    expect(state.children.map((child) => child.displayName)).toEqual([
      'Blake',
      'Avery',
    ]);
    expect(state.children.map((child) => child.sortOrder)).toEqual([0, 1]);
  });

  it('increments, decrements, and sets points without allowing negatives', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    const childId = state.children[0].id;
    state = appDataReducer(state, {
      type: 'incrementPoints',
      childId,
      amount: 2,
    });
    state = appDataReducer(state, {
      type: 'decrementPoints',
      childId,
      amount: 1,
    });
    state = appDataReducer(state, { type: 'setPoints', childId, points: -99 });

    expect(state.children[0]?.points).toBe(0);
  });

  it('verifies the default parent pin', () => {
    const state = createDefaultAppData();

    expect(DEFAULT_PARENT_PIN).toBe('0000');
    expect(verifyParentPin(state, DEFAULT_PARENT_PIN)).toBe(true);
    expect(verifyParentPin(state, '1234')).toBe(false);
  });

  it('defaults ui preferences to system and stores theme changes', () => {
    let state = createDefaultAppData();

    expect(state.uiPreferences.themeMode).toBe('system');

    state = appDataReducer(state, { type: 'setThemeMode', themeMode: 'dark' });

    expect(state.uiPreferences.themeMode).toBe('dark');
  });

  it('starts, pauses, resumes, and resets the shared timer', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'startTimer', startedAt: 123_000 });
    expect(state.timerState).toEqual({
      cycleStartedAt: 123_000,
      isRunning: true,
      pausedRemainingMs: null,
    });

    state = appDataReducer(state, { type: 'pauseTimer', pausedAt: 243_000 });
    expect(state.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: 780_000,
    });

    state = appDataReducer(state, { type: 'startTimer', startedAt: 456_000 });
    expect(state.timerState).toEqual({
      cycleStartedAt: 336_000,
      isRunning: true,
      pausedRemainingMs: null,
    });

    state = appDataReducer(state, { type: 'resetTimer' });
    expect(state.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    });
  });
});

describe('computeTimerSnapshot', () => {
  it('reports running timer progress and next trigger time', () => {
    const state = createDefaultAppData();
    const snapshot = computeTimerSnapshot(
      state.timerConfig,
      { cycleStartedAt: 1_000, isRunning: true, pausedRemainingMs: null },
      61_000,
    );

    expect(snapshot.isRunning).toBe(true);
    expect(formatDuration(snapshot.remainingMs)).toBe('14:00');
    expect(snapshot.nextTriggerAt).toBe(901_000);
  });

  it('returns a full interval when the timer is paused', () => {
    const state = createDefaultAppData();
    const snapshot = computeTimerSnapshot(
      state.timerConfig,
      state.timerState,
      0,
    );

    expect(snapshot.isRunning).toBe(false);
    expect(formatDuration(snapshot.remainingMs)).toBe('15:00');
  });

  it('returns the paused remaining time when the timer is paused mid-cycle', () => {
    const state = createDefaultAppData();
    const snapshot = computeTimerSnapshot(
      state.timerConfig,
      {
        cycleStartedAt: null,
        isRunning: false,
        pausedRemainingMs: 780_000,
      },
      0,
    );

    expect(snapshot.isRunning).toBe(false);
    expect(formatDuration(snapshot.remainingMs)).toBe('13:00');
  });
});
