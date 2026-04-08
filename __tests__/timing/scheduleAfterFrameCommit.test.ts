import { scheduleAfterFrameCommit } from '../../src/timing/scheduleAfterFrameCommit';

describe('scheduleAfterFrameCommit', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  afterEach(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs the callback after two animation frames when raf is available', () => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const callback = jest.fn();

    global.requestAnimationFrame = jest.fn(
      (frameCallback: FrameRequestCallback) => {
        const frameId = nextFrameId++;
        scheduledFrames.set(frameId, frameCallback);
        return frameId;
      },
    );
    global.cancelAnimationFrame = jest.fn((frameId: number) => {
      scheduledFrames.delete(frameId);
    });

    scheduleAfterFrameCommit(callback);

    expect(callback).not.toHaveBeenCalled();

    scheduledFrames.get(1)?.(0);
    scheduledFrames.delete(1);

    expect(callback).not.toHaveBeenCalled();

    scheduledFrames.get(2)?.(16);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending frames before the callback runs', () => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const callback = jest.fn();

    global.requestAnimationFrame = jest.fn(
      (frameCallback: FrameRequestCallback) => {
        const frameId = nextFrameId++;
        scheduledFrames.set(frameId, frameCallback);
        return frameId;
      },
    );
    global.cancelAnimationFrame = jest.fn((frameId: number) => {
      scheduledFrames.delete(frameId);
    });

    const cancel = scheduleAfterFrameCommit(callback);

    cancel();

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it('falls back to nested timeouts when raf is unavailable', () => {
    jest.useFakeTimers();
    const callback = jest.fn();

    Object.defineProperty(global, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(global, 'cancelAnimationFrame', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    scheduleAfterFrameCommit(callback);

    expect(callback).not.toHaveBeenCalled();

    jest.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
