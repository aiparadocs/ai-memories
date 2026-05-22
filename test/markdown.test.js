import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, isSafeUrl, formatContent } from '../lib/markdown.js';

test('escapeHtml escapes special chars', () => {
  assert.equal(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
});

test('isSafeUrl allows http/https/mailto only', () => {
  assert.equal(isSafeUrl('https://example.com'), true);
  assert.equal(isSafeUrl('http://example.com'), true);
  assert.equal(isSafeUrl('mailto:a@b.com'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('data:text/html,x'), false);
  assert.equal(isSafeUrl(''), false);
});

test('formatContent renders bold, italic, inline code, heading', () => {
  assert.match(formatContent('**b**'), /<strong>b<\/strong>/);
  assert.match(formatContent('*i*'), /<em>i<\/em>/);
  assert.match(formatContent('`c`'), /<code>c<\/code>/);
  assert.match(formatContent('## H'), /<h2>H<\/h2>/);
});

test('formatContent wraps unordered list in <ul>', () => {
  const out = formatContent('- a\n- b');
  assert.match(out, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
});

test('formatContent wraps ordered list in <ol>', () => {
  const out = formatContent('1. a\n2. b');
  assert.match(out, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
});

test('formatContent makes safe links but not javascript:', () => {
  assert.match(formatContent('[x](https://e.com)'), /<a href="https:\/\/e\.com"[^>]*>x<\/a>/);
  const unsafe = formatContent('[x](javascript:alert(1))');
  assert.doesNotMatch(unsafe, /<a /);
  assert.match(unsafe, /x/);
});

test('formatContent escapes raw HTML (XSS safe)', () => {
  const out = formatContent('<script>alert(1)</script>');
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
});

test('formatContent preserves and escapes code blocks', () => {
  const out = formatContent('```js\n<x>\n```');
  assert.match(out, /<pre><code>&lt;x&gt;\n<\/code><\/pre>/);
});

test('formatContent does not corrupt literal "CB0" text', () => {
  const out = formatContent('hello CB0 world');
  assert.match(out, /hello CB0 world/);
  assert.doesNotMatch(out, /undefined/);
});
