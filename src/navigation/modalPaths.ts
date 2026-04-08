const BLOCKING_ROUTE_MODAL_PATHS = new Set([
  '/parent-unlock',
  '/timer-check-in',
]);

export function isBlockingRouteModalPath(pathname?: string | null) {
  return pathname != null && BLOCKING_ROUTE_MODAL_PATHS.has(pathname);
}
