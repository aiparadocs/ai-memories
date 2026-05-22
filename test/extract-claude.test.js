import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeConvId, toEpoch, extractMessagesClaude, buildIndexClaude } from '../lib/extract-claude.js';

const conv = {
  uuid: 'u1',
  name: 'テスト会話',
  created_at: '2026-03-13T17:51:33Z',
  updated_at: '2026-03-14T00:00:00Z',
  chat_messages: [
    { sender: 'human', created_at: '2026-03-13T17:51:33Z', content: [{ type: 'text', text: 'こんにちは' }], attachments: [], files: [] },
    { sender: 'assistant', created_at: '2026-03-13T17:51:40Z', content: [
        { type: 'thinking', thinking: '考え中' },
        { type: 'text', text: 'やあ' },
        { type: 'tool_use', name: 'view', input: { path: '/x' }, message: '読む' },
        { type: 'tool_result', content: [{ type: 'text', text: 'ファイル内容' }], is_error: false }
      ], attachments: [], files: [] },
    { sender: 'human', created_at: '2026-03-13T18:00:00Z', text: '添付あり', content: [{ type: 'text', text: '添付あり' }],
      attachments: [{ file_name: 'doc.txt', file_type: 'txt', extracted_content: '文書本文' }],
      files: [{ file_name: 'image.png' }] },
  ],
};

test('claudeConvId returns uuid', () => {
  assert.equal(claudeConvId({ uuid: 'abc' }), 'abc');
});

test('toEpoch converts ISO to epoch seconds, null on invalid', () => {
  assert.equal(toEpoch('2026-03-13T17:51:33Z'), Math.floor(Date.parse('2026-03-13T17:51:33Z') / 1000));
  assert.equal(toEpoch(''), null);
  assert.equal(toEpoch('not-a-date'), null);
});

test('extractMessagesClaude maps sender to role and builds ordered blocks', () => {
  const m = extractMessagesClaude(conv);
  assert.equal(m.length, 3);
  assert.equal(m[0].role, 'user');
  assert.equal(m[0].isHidden, false);
  assert.equal(m[0].isBranch, false);
  assert.deepEqual(m[0].blocks, [{ type: 'text', text: 'こんにちは' }]);
  assert.equal(m[1].role, 'assistant');
  assert.deepEqual(m[1].blocks.map(b => b.type), ['thinking', 'text', 'tool_use', 'tool_result']);
  assert.equal(m[1].blocks[0].text, '考え中');
  assert.equal(m[1].blocks[2].name, 'view');
  assert.equal(m[1].blocks[2].input.path, '/x');
  assert.equal(m[1].blocks[3].text, 'ファイル内容');
  assert.equal(m[1].blocks[3].isError, false);
  assert.equal(typeof m[1].timestamp, 'number');
});

test('extractMessagesClaude includes attachment text and file placeholder', () => {
  const m = extractMessagesClaude(conv);
  const types = m[2].blocks.map(b => b.type);
  assert.ok(types.includes('attachment'));
  assert.ok(types.includes('file'));
  const att = m[2].blocks.find(b => b.type === 'attachment');
  assert.equal(att.text, '文書本文');
  assert.equal(att.fileName, 'doc.txt');
  const file = m[2].blocks.find(b => b.type === 'file');
  assert.equal(file.fileName, 'image.png');
});

test('extractMessagesClaude skips empty messages', () => {
  const c2 = { uuid: 'x', name: 'e', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    chat_messages: [{ sender: 'human', created_at: '2026-01-01T00:00:00Z', content: [], attachments: [], files: [] }] };
  assert.equal(extractMessagesClaude(c2).length, 0);
});

test('buildIndexClaude sorts by update_time desc and builds search text', () => {
  const older = { uuid: 'old', name: 'Old', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', chat_messages: conv.chat_messages };
  const newer = { uuid: 'new', name: 'New', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z', chat_messages: conv.chat_messages };
  const { index, searchTexts } = buildIndexClaude([older, newer]);
  assert.equal(index[0].id, 'new');
  assert.equal(index[1].id, 'old');
  assert.match(searchTexts['new'], /考え中/);
  assert.match(searchTexts['new'], /文書本文/);
});
