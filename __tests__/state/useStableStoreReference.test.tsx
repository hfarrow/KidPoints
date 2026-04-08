import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useStableStoreReference } from '../../src/state/useStableStoreReference';

type ProbeProps = {
  devRefreshToken?: unknown;
  isDevelopment?: boolean;
  value: string;
};

function Probe({ devRefreshToken, isDevelopment, value }: ProbeProps) {
  const store = useStableStoreReference(
    () => ({
      value,
    }),
    {
      devRefreshToken,
      isDevelopment,
    },
  );

  return <Text>{store.value}</Text>;
}

describe('useStableStoreReference', () => {
  it('keeps the existing value when the dev refresh token does not change', () => {
    const refreshToken = Symbol('refresh-token');
    const { rerender } = render(
      <Probe devRefreshToken={refreshToken} isDevelopment value="first" />,
    );

    rerender(
      <Probe devRefreshToken={refreshToken} isDevelopment value="second" />,
    );

    expect(screen.getByText('first')).toBeTruthy();
  });

  it('recreates the value when the dev refresh token changes in development', () => {
    const { rerender } = render(
      <Probe
        devRefreshToken={Symbol('refresh-token-1')}
        isDevelopment
        value="first"
      />,
    );

    rerender(
      <Probe
        devRefreshToken={Symbol('refresh-token-2')}
        isDevelopment
        value="second"
      />,
    );

    expect(screen.getByText('second')).toBeTruthy();
  });

  it('ignores refresh token changes outside development', () => {
    const { rerender } = render(
      <Probe
        devRefreshToken={Symbol('refresh-token-1')}
        isDevelopment={false}
        value="first"
      />,
    );

    rerender(
      <Probe
        devRefreshToken={Symbol('refresh-token-2')}
        isDevelopment={false}
        value="second"
      />,
    );

    expect(screen.getByText('first')).toBeTruthy();
  });
});
