import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import App from '../src/App';

describe('App', () => {
  it('renders the tooling readiness message', () => {
    const { getByText } = render(<App />);

    expect(getByText('KidPoints tooling is ready.')).toBeTruthy();
  });
});
