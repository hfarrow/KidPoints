import { describe, expect, it } from '@jest/globals';

import {
  appDataReducer,
  createDefaultAppData,
  DEFAULT_PARENT_PIN,
  sortChildren,
  verifyParentPin,
} from '../../../src/features/app/state';
import {
  computeTimerSnapshot,
  formatDuration,
} from '../../../src/features/app/timer';

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

    expect(
      sortChildren(state.children).map((child) => child.displayName),
    ).toEqual(['Blake', 'Avery']);
    expect(
      sortChildren(state.children).map((child) => child.sortOrder),
    ).toEqual([0, 1]);
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

  it('renames a child while preserving the rest of the child profile', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    const originalChild = state.children[0];

    state = appDataReducer(state, {
      type: 'renameChild',
      childId: originalChild.id,
      name: 'Rowan',
    });

    expect(state.children[0]).toMatchObject({
      ...originalChild,
      displayName: 'Rowan',
    });
  });

  it('archives a child without deleting their data and normalizes active sort order', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    state = appDataReducer(state, { type: 'addChild', name: 'Blake' });
    const archivedChild = state.children[0];

    state = appDataReducer(state, {
      type: 'archiveChild',
      childId: archivedChild.id,
      archivedAt: 500,
    });

    expect(state.children).toContainEqual({
      ...archivedChild,
      archivedAt: 500,
      isArchived: true,
    });
    expect(
      state.children
        .filter((child) => !child.isArchived)
        .map((child) => child.sortOrder),
    ).toEqual([0]);
  });

  it('restores an archived child with their existing data and appends them after active children', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    state = appDataReducer(state, { type: 'addChild', name: 'Blake' });
    const archivedChild = state.children[0];

    state = appDataReducer(state, {
      type: 'archiveChild',
      childId: archivedChild.id,
      archivedAt: 500,
    });
    state = appDataReducer(state, {
      type: 'restoreChild',
      childId: archivedChild.id,
    });

    expect(
      state.children.find((child) => child.id === archivedChild.id),
    ).toMatchObject({
      ...archivedChild,
      archivedAt: null,
      isArchived: false,
      sortOrder: 1,
    });
  });

  it('deletes a child permanently only when requested', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, { type: 'addChild', name: 'Avery' });
    const childId = state.children[0].id;

    state = appDataReducer(state, {
      type: 'deleteChildPermanently',
      childId,
    });

    expect(state.children).toEqual([]);
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
    expect(state.timerRuntimeState).toMatchObject({
      nextTriggerAt: 1_023_000,
    });

    state = appDataReducer(state, { type: 'pauseTimer', pausedAt: 243_000 });
    expect(state.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: 780_000,
    });
    expect(state.timerRuntimeState.nextTriggerAt).toBeNull();

    state = appDataReducer(state, { type: 'startTimer', startedAt: 456_000 });
    expect(state.timerState).toEqual({
      cycleStartedAt: 336_000,
      isRunning: true,
      pausedRemainingMs: null,
    });
    expect(state.timerRuntimeState.sessionId).toBeTruthy();
    expect(state.timerRuntimeState.nextTriggerAt).toBe(1_236_000);

    state = appDataReducer(state, { type: 'resetTimer' });
    expect(state.timerState).toEqual({
      cycleStartedAt: null,
      isRunning: false,
      pausedRemainingMs: null,
    });
    expect(state.timerRuntimeState).toEqual({
      sessionId: null,
      nextTriggerAt: null,
      lastTriggeredAt: null,
    });
    expect(state.expiredIntervals).toEqual([]);
  });

  it('supports intervals shorter than one minute using seconds', () => {
    let state = createDefaultAppData();

    state = appDataReducer(state, {
      type: 'updateTimerConfig',
      patch: {
        intervalMinutes: 0,
        intervalSeconds: 15,
      },
    });
    state = appDataReducer(state, { type: 'startTimer', startedAt: 10_000 });

    expect(state.timerRuntimeState.nextTriggerAt).toBe(25_000);

    state = appDataReducer(state, { type: 'pauseTimer', pausedAt: 16_000 });

    expect(state.timerState.pausedRemainingMs).toBe(9_000);
  });

  it('removes an expired interval after all pending child actions are resolved', () => {
    let state = createDefaultAppData();

    state = {
      ...state,
      expiredIntervals: [
        {
          childActions: [
            {
              childId: 'child-1',
              childName: 'Ava',
              status: 'pending',
            },
          ],
          intervalId: 'interval-1',
          notificationId: 5001,
          sessionId: 'session-1',
          triggeredAt: 1_000,
        },
      ],
    };

    state = appDataReducer(state, {
      type: 'setExpiredIntervalChildStatus',
      childId: 'child-1',
      intervalId: 'interval-1',
      status: 'awarded',
    });

    expect(state.expiredIntervals).toEqual([]);
  });
});

describe('computeTimerSnapshot', () => {
  it('reports running timer progress and next trigger time', () => {
    const state = createDefaultAppData();
    const snapshot = computeTimerSnapshot(
      state.timerConfig,
      { cycleStartedAt: 1_000, isRunning: true, pausedRemainingMs: null },
      {
        sessionId: 'session-1',
        nextTriggerAt: 901_000,
        lastTriggeredAt: null,
      },
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
      state.timerRuntimeState,
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
      state.timerRuntimeState,
      0,
    );

    expect(snapshot.isRunning).toBe(false);
    expect(formatDuration(snapshot.remainingMs)).toBe('13:00');
  });

  it('computes countdowns for second-based intervals', () => {
    const state = createDefaultAppData();
    const snapshot = computeTimerSnapshot(
      {
        ...state.timerConfig,
        intervalMinutes: 0,
        intervalSeconds: 15,
      },
      { cycleStartedAt: 1_000, isRunning: true, pausedRemainingMs: null },
      {
        sessionId: 'session-1',
        nextTriggerAt: 16_000,
        lastTriggeredAt: null,
      },
      4_000,
    );

    expect(snapshot.isRunning).toBe(true);
    expect(snapshot.remainingMs).toBe(12_000);
    expect(formatDuration(snapshot.remainingMs)).toBe('00:12');
  });
});
