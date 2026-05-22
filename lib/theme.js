export const THEMES = ['auto', 'light', 'dark'];

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'auto';
}

export function nextTheme(current) {
  const i = THEMES.indexOf(normalizeTheme(current)); // invalid -> 'auto' (=0)
  return THEMES[(i + 1) % THEMES.length];
}
