import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat } from '../lib/format.js';

test('detectFormat returns claude for chat_messages', () => {
  assert.equal(detectFormat([{ chat_messages: [] }]), 'claude');
});

test('detectFormat returns chatgpt for mapping', () => {
  assert.equal(detectFormat([{ mapping: {} }]), 'chatgpt');
});

test('detectFormat defaults to chatgpt for empty or invalid', () => {
  assert.equal(detectFormat([]), 'chatgpt');
  assert.equal(detectFormat(null), 'chatgpt');
  assert.equal(detectFormat([{}]), 'chatgpt');
});
