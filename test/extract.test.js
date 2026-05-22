import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convId, extractMessages, buildIndex, searchMatch } from '../lib/extract.js';

function node(parent, children, message) {
  return { parent, children, message };
}
function textMsg(role, text, opts = {}) {
  return {
    author: { role },
    content: { content_type: 'text', parts: [text] },
    create_time: opts.t || 1,
    metadata: opts.hidden ? { is_visually_hidden_from_conversation: true } : {},
  };
}

const linear = {
  conversation_id: 'c1',
  title: 'Hello',
  create_time: 100,
  update_time: 200,
  mapping: {
    root: node(null, ['u1']),
    u1: node('root', ['a1'], textMsg('user', 'hi there')),
    a1: node('u1', [], textMsg('assistant', 'hello back')),
  },
};

test('convId prefers conversation_id', () => {
  assert.equal(convId({ conversation_id: 'x', id: 'y' }), 'x');
  assert.equal(convId({ id: 'y' }), 'y');
});

test('extractMessages returns user then assistant', () => {
  const m = extractMessages(linear);
  assert.equal(m.length, 2);
  assert.equal(m[0].role, 'user');
  assert.equal(m[0].content, 'hi there');
  assert.equal(m[1].role, 'assistant');
  assert.equal(m[0].isBranch, false);
});

test('extractMessages flags branches (first child not a branch)', () => {
  const branched = {
    conversation_id: 'c2', title: 'B', create_time: 1, update_time: 2,
    mapping: {
      root: node(null, ['u1']),
      u1: node('root', ['a1', 'a2'], textMsg('user', 'q')),
      a1: node('u1', [], textMsg('assistant', 'answer one')),
      a2: node('u1', [], textMsg('assistant', 'answer two')),
    },
  };
  const m = extractMessages(branched);
  const a1 = m.find(x => x.content === 'answer one');
  const a2 = m.find(x => x.content === 'answer two');
  assert.equal(a1.isBranch, false);
  assert.equal(a2.isBranch, true);
  assert.equal(a2.branchIndex, 2);
  assert.equal(a2.branchTotal, 2);
});

test('extractMessages includes hidden/system with isHidden flag', () => {
  const conv = {
    conversation_id: 'c3', title: 'S', create_time: 1, update_time: 2,
    mapping: {
      root: node(null, ['s1']),
      s1: node('root', ['u1'], textMsg('system', 'sys note')),
      u1: node('s1', [], textMsg('user', 'visible')),
    },
  };
  const m = extractMessages(conv);
  const sys = m.find(x => x.content === 'sys note');
  assert.equal(sys.isHidden, true);
});

test('extractMessages skips empty-text messages', () => {
  const conv = {
    conversation_id: 'c4', title: 'E', create_time: 1, update_time: 2,
    mapping: {
      root: node(null, ['u1']),
      u1: node('root', [], textMsg('user', '   ')),
    },
  };
  assert.equal(extractMessages(conv).length, 0);
});

test('buildIndex sorts by update_time desc and builds lowercased search text', () => {
  const older = { conversation_id: 'old', title: 'Old', create_time: 1, update_time: 10, mapping: linear.mapping };
  const newer = { conversation_id: 'new', title: 'New', create_time: 1, update_time: 99, mapping: linear.mapping };
  const { index, searchTexts } = buildIndex([older, newer]);
  assert.equal(index[0].id, 'new');
  assert.equal(index[1].id, 'old');
  assert.match(searchTexts['new'], /hi there/);
});

test('searchMatch is case-insensitive over title and body', () => {
  const { index, searchTexts } = buildIndex([linear]);
  assert.deepEqual(searchMatch('HELLO', index, searchTexts), ['c1']);
  assert.deepEqual(searchMatch('hi there', index, searchTexts), ['c1']);
  assert.deepEqual(searchMatch('zzz', index, searchTexts), []);
  assert.deepEqual(searchMatch('', index, searchTexts), ['c1']);
});

test('extractMessages handles very deep conversations without stack overflow', () => {
  const n = 20000;
  const mapping = { root: { parent: null, children: ['m0'] } };
  for (let i = 0; i < n; i++) {
    mapping['m' + i] = {
      parent: i === 0 ? 'root' : 'm' + (i - 1),
      children: i < n - 1 ? ['m' + (i + 1)] : [],
      message: {
        author: { role: i % 2 === 0 ? 'user' : 'assistant' },
        content: { content_type: 'text', parts: ['msg' + i] },
        create_time: i,
        metadata: {},
      },
    };
  }
  const conv = { conversation_id: 'deep', title: 'Deep', create_time: 1, update_time: 1, mapping };
  const m = extractMessages(conv);
  assert.equal(m.length, n);
});
