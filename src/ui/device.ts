// Touch detection. iPads report as "Macintosh" in Safari, so check the pointer
// type and touch points rather than the user agent.

export const isTouch: boolean =
  typeof window !== 'undefined' &&
  ((window.matchMedia?.('(any-pointer: coarse)').matches ?? false) || (navigator.maxTouchPoints ?? 0) > 0);

/** Pick wording for touch screens or for mouse and keyboard. */
export const tapOr = (touch: string, desk: string) => (isTouch ? touch : desk);
