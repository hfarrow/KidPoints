export function scheduleAfterFrameCommit(callback: () => void) {
  if (
    typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function'
  ) {
    let secondFrameId: number | null = null;
    const firstFrameId = requestAnimationFrame(() => {
      secondFrameId = requestAnimationFrame(() => {
        callback();
      });
    });

    return () => {
      cancelAnimationFrame(firstFrameId);

      if (secondFrameId != null) {
        cancelAnimationFrame(secondFrameId);
      }
    };
  }

  let secondTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const firstTimeoutId = setTimeout(() => {
    secondTimeoutId = setTimeout(() => {
      callback();
    }, 0);
  }, 0);

  return () => {
    clearTimeout(firstTimeoutId);

    if (secondTimeoutId != null) {
      clearTimeout(secondTimeoutId);
    }
  };
}
