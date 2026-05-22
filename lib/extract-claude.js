export function claudeConvId(c) {
  return c.uuid;
}

export function toEpoch(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

function blocksFromMessage(m) {
  const blocks = [];
  const content = Array.isArray(m.content) ? m.content : [];
  for (const b of content) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && b.text) {
      blocks.push({ type: 'text', text: b.text });
    } else if (b.type === 'thinking' && b.thinking) {
      blocks.push({ type: 'thinking', text: b.thinking });
    } else if (b.type === 'tool_use') {
      blocks.push({ type: 'tool_use', name: b.name || '', input: b.input, message: b.message || '' });
    } else if (b.type === 'tool_result') {
      const text = Array.isArray(b.content)
        ? b.content.filter(x => x && x.type === 'text').map(x => x.text).join('\n')
        : '';
      blocks.push({ type: 'tool_result', text, isError: !!b.is_error });
    }
  }
  if (blocks.length === 0 && typeof m.text === 'string' && m.text.trim()) {
    blocks.push({ type: 'text', text: m.text });
  }
  for (const a of (m.attachments || [])) {
    if (a && a.extracted_content) {
      blocks.push({ type: 'attachment', fileName: a.file_name || '', fileType: a.file_type || '', text: a.extracted_content });
    }
  }
  for (const f of (m.files || [])) {
    if (f && f.file_name) {
      blocks.push({ type: 'file', fileName: f.file_name });
    }
  }
  return blocks;
}

export function extractMessagesClaude(conv) {
  const messages = [];
  for (const m of (conv.chat_messages || [])) {
    const blocks = blocksFromMessage(m);
    if (blocks.length === 0) continue;
    messages.push({
      role: m.sender === 'human' ? 'user' : 'assistant',
      timestamp: toEpoch(m.created_at),
      isHidden: false,
      isBranch: false,
      branchIndex: null,
      branchTotal: null,
      blocks,
    });
  }
  return messages;
}

function conversationTextClaude(conv) {
  const parts = [];
  for (const m of (conv.chat_messages || [])) {
    for (const b of (m.content || [])) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'text' && b.text) parts.push(b.text);
      else if (b.type === 'thinking' && b.thinking) parts.push(b.thinking);
      else if (b.type === 'tool_use') {
        if (b.name) parts.push(b.name);
        if (b.message) parts.push(b.message);
        if (b.input !== undefined) parts.push(JSON.stringify(b.input));
      } else if (b.type === 'tool_result' && Array.isArray(b.content)) {
        parts.push(b.content.filter(x => x && x.type === 'text').map(x => x.text).join('\n'));
      }
    }
    for (const a of (m.attachments || [])) {
      if (a && a.extracted_content) parts.push(a.extracted_content);
    }
  }
  return parts.join('\n').toLowerCase();
}

export function buildIndexClaude(conversations) {
  const index = conversations.map(c => ({
    id: claudeConvId(c),
    title: c.name || '無題の会話',
    create_time: toEpoch(c.created_at),
    update_time: toEpoch(c.updated_at),
  }));
  index.sort((a, b) => (b.update_time || 0) - (a.update_time || 0));

  const searchTexts = {};
  for (const c of conversations) {
    searchTexts[claudeConvId(c)] = (c.name || '').toLowerCase() + '\n' + conversationTextClaude(c);
  }
  return { index, searchTexts };
}
