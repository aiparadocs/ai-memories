import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, nextTheme, normalizeTheme } from '../lib/theme.js';

test('THEMES is a frozen auto/light/dark array', () => {
  assert.deepEqual(THEMES, ['auto', 'light', 'dark']);
  assert.ok(Object.isFrozen(THEMES));
});

test('nextTheme cycles auto -> light -> dark -> auto', () => {
  assert.equal(nextTheme('auto'), 'light');
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'auto');
});

test('nextTheme treats unknown input as auto and returns light', () => {
  assert.equal(nextTheme('garbage'), 'light');
});

test('normalizeTheme keeps valid, defaults invalid/null/undefined to auto', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme(null), 'auto');
  assert.equal(normalizeTheme(undefined), 'auto');
  assert.equal(normalizeTheme('xxx'), 'auto');
});
