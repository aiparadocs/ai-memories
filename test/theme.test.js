import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, nextTheme, normalizeTheme } from '../lib/theme.js';

test('THEMES is auto/light/dark', () => {
  assert.deepEqual(THEMES, ['auto', 'light', 'dark']);
});

test('nextTheme cycles auto -> light -> dark -> auto', () => {
  assert.equal(nextTheme('auto'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'auto');
});

test('nextTheme on unknown returns light (treated as auto then advanced)', () => {
  assert.equal(nextTheme('garbage'), 'light');
});

test('normalizeTheme keeps valid, defaults invalid to auto', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme(null), 'auto');
  assert.equal(normalizeTheme('xxx'), 'auto');
});
