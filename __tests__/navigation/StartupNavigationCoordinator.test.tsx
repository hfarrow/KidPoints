import { act, render, waitFor } from '@testing-library/react-native';

import { StartupNavigationCoordinator } from '../../src/navigation/StartupNavigationCoordinator';
import {
  clearStartupNavigationRequests,
  useStartupNavigationStore,
} from '../../src/navigation/startupNavigationStore';

let mockPathname = '/';
let mockRootNavigationKey: string | undefined = 'root-ready';
let mockSegments = ['(tabs)', 'index'];
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRootNavigationState: () =>
    mockRootNavigationKey ? { key: mockRootNavigationKey } : undefined,
  useRouter: () => ({
    push: mockPush,
  }),
  useSegments: () => mockSegments,
}));

describe('StartupNavigationCoordinator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearStartupNavigationRequests();
    mockPathname = '/';
    mockRootNavigationKey = 'root-ready';
    mockSegments = ['(tabs)', 'index'];
    mockPush.mockReset();
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        return setTimeout(() => callback(16), 16) as unknown as number;
      });
    jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation((handle: number) => {
        clearTimeout(handle);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('waits for a concrete route before dispatching queued startup navigation', async () => {
    mockSegments = ['(root)'];
    useStartupNavigationStore.getState().queueRequest({
      href: '/parent-unlock?mode=setup',
      id: 'parent-pin-setup',
      source: 'test',
      targetPathname: '/parent-unlock',
    });

    const { rerender } = render(<StartupNavigationCoordinator />);

    act(() => {
      jest.advanceTimersByTime(32);
    });

    expect(mockPush).not.toHaveBeenCalled();

    mockSegments = ['(tabs)', 'index'];

    rerender(<StartupNavigationCoordinator />);

    act(() => {
      jest.advanceTimersByTime(32);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/parent-unlock?mode=setup');
    });
  });

  it('completes the request after the target route is observed', async () => {
    useStartupNavigationStore.getState().queueRequest({
      href: '/parent-unlock?mode=setup',
      id: 'parent-pin-setup',
      source: 'test',
      targetPathname: '/parent-unlock',
    });

    const { rerender } = render(<StartupNavigationCoordinator />);

    act(() => {
      jest.advanceTimersByTime(32);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/parent-unlock?mode=setup');
    });

    mockPathname = '/parent-unlock';

    rerender(<StartupNavigationCoordinator />);

    await waitFor(() => {
      expect(useStartupNavigationStore.getState().requests).toHaveLength(0);
    });
  });

  it('does not dispatch the same startup navigation request twice when it is queued redundantly', async () => {
    useStartupNavigationStore.getState().queueRequest({
      href: '/timer-check-in',
      id: 'notifications-check-in',
      source: 'notifications',
      targetPathname: '/timer-check-in',
    });
    useStartupNavigationStore.getState().queueRequest({
      href: '/timer-check-in',
      id: 'notifications-check-in',
      source: 'notifications',
      targetPathname: '/timer-check-in',
    });

    render(<StartupNavigationCoordinator />);

    act(() => {
      jest.advanceTimersByTime(32);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/timer-check-in');
    });
  });
});
