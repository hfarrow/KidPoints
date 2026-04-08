import { isBlockingRouteModalPath } from '../../src/navigation/modalPaths';

describe('modalPaths', () => {
  it('treats route-backed blocking modals as blocking paths', () => {
    expect(isBlockingRouteModalPath('/parent-unlock')).toBe(true);
  });

  it('does not treat normal screens as blocking modal paths', () => {
    expect(isBlockingRouteModalPath('/')).toBe(false);
    expect(isBlockingRouteModalPath('/settings')).toBe(false);
    expect(isBlockingRouteModalPath(null)).toBe(false);
  });
});
