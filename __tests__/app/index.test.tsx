import { render, screen } from '@testing-library/react-native';
import RebuildHomeScreen from '../../app/index';

describe('RebuildHomeScreen', () => {
  it('renders the rebuild placeholder copy', () => {
    render(<RebuildHomeScreen />);

    expect(screen.getByText('Rebuild in progress')).toBeTruthy();
    expect(
      screen.getByText(
        'The app shell is reset and ready for us to rebuild features layer by layer.',
      ),
    ).toBeTruthy();
  });
});
