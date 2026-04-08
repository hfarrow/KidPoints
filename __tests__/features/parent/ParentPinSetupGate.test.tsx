import { render, waitFor } from '@testing-library/react-native';

import { ParentPinSetupGate } from '../../../src/features/parent/ParentPinSetupGate';
import {
  clearStartupNavigationRequests,
  useStartupNavigationStore,
} from '../../../src/navigation/startupNavigationStore';
import { LocalSettingsStoreProvider } from '../../../src/state/localSettingsStore';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

describe('ParentPinSetupGate', () => {
  beforeEach(() => {
    clearStartupNavigationRequests();
  });

  it('queues parent pin setup when the device has no configured pin', async () => {
    render(
      <LocalSettingsStoreProvider storage={createMemoryStorage()}>
        <ParentPinSetupGate />
      </LocalSettingsStoreProvider>,
    );

    await waitFor(() => {
      expect(useStartupNavigationStore.getState().requests).toMatchObject([
        {
          href: '/parent-unlock?mode=setup',
          id: 'parent-pin-setup',
          source: 'parent-pin-setup-gate',
          targetPathname: '/parent-unlock',
        },
      ]);
    });
  });

  it('does not queue setup when a pin is already configured', async () => {
    render(
      <LocalSettingsStoreProvider
        initialParentPin="2468"
        storage={createMemoryStorage()}
      >
        <ParentPinSetupGate />
      </LocalSettingsStoreProvider>,
    );

    await waitFor(() => {
      expect(useStartupNavigationStore.getState().requests).toHaveLength(0);
    });
  });
});
