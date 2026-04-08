import { useRef } from 'react';

type UseStableStoreReferenceOptions = {
  devRefreshToken?: unknown;
  isDevelopment?: boolean;
};

export function useStableStoreReference<T>(
  createValue: () => T,
  {
    devRefreshToken,
    isDevelopment = __DEV__,
  }: UseStableStoreReferenceOptions = {},
) {
  const valueRef = useRef<T | null>(null);
  const refreshTokenRef = useRef(devRefreshToken);

  if (
    !valueRef.current ||
    (isDevelopment && refreshTokenRef.current !== devRefreshToken)
  ) {
    valueRef.current = createValue();
    refreshTokenRef.current = devRefreshToken;
  }

  return valueRef.current;
}
