export const CHILD_MODE_SURFACE = '#dbeafe';
export const PARENT_MODE_SURFACE = '#fef3c7';

export function getAppScreenSurface(isParentMode: boolean) {
  return isParentMode ? PARENT_MODE_SURFACE : CHILD_MODE_SURFACE;
}
