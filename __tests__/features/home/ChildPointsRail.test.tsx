import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { useState } from 'react';

import { ChildPointsRail } from '../../../src/features/home/ChildPointsRail';
import { AppThemeProvider } from '../../../src/features/theme/themeContext';
import type { SharedCommandResult } from '../../../src/state/sharedTypes';
import { createMemoryStorage } from '../../testUtils/memoryStorage';

type ChildPointsRailHarnessProps = {
  childName?: string;
  initialPoints?: number;
};

function ChildPointsRailHarness({
  childName = 'Ava',
  initialPoints = 4,
}: ChildPointsRailHarnessProps) {
  const [points, setPoints] = useState(initialPoints);

  return (
    <AppThemeProvider initialThemeMode="light" storage={createMemoryStorage()}>
      <ChildPointsRail
        childId="child-ava"
        childName={childName}
        isParentUnlocked
        onAdjustPoints={(delta): SharedCommandResult => {
          setPoints((currentPoints) => currentPoints + delta);
          return { ok: true };
        }}
        onEditPoints={() => {}}
        points={points}
      />
    </AppThemeProvider>
  );
}

describe('ChildPointsRail', () => {
  it('settles on the next total after incrementing', async () => {
    render(<ChildPointsRailHarness initialPoints={4} />);

    fireEvent.press(screen.getByLabelText('Increase Ava points'));

    await waitFor(() => {
      expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    });
  });

  it('settles on the previous total after decrementing', async () => {
    render(<ChildPointsRailHarness initialPoints={4} />);

    fireEvent.press(screen.getByLabelText('Decrease Ava points'));

    await waitFor(() => {
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });
  });

  it('keeps rapid repeated taps aligned with the final total', async () => {
    render(<ChildPointsRailHarness initialPoints={4} />);

    fireEvent.press(screen.getByLabelText('Increase Ava points'));
    fireEvent.press(screen.getByLabelText('Increase Ava points'));
    fireEvent.press(screen.getByLabelText('Increase Ava points'));

    await waitFor(() => {
      expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    });
  });

  it('snaps to an external total change and clears stale local queue state', async () => {
    const onAdjustPoints = (): SharedCommandResult => ({ ok: true });
    const { rerender } = render(
      <AppThemeProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ChildPointsRail
          childId="child-ava"
          childName="Ava"
          isParentUnlocked
          onAdjustPoints={onAdjustPoints}
          onEditPoints={() => {}}
          points={4}
        />
      </AppThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Increase Ava points'));

    rerender(
      <AppThemeProvider
        initialThemeMode="light"
        storage={createMemoryStorage()}
      >
        <ChildPointsRail
          childId="child-ava"
          childName="Ava"
          isParentUnlocked
          onAdjustPoints={onAdjustPoints}
          onEditPoints={() => {}}
          points={11}
        />
      </AppThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('11').length).toBeGreaterThan(0);
    });
  });
});
