export function convId(c) {
  return c.conversation_id || c.id;
}

export function extractMessages(conv) {
  const messages = [];
  const mapping = conv.mapping;
  if (!mapping) return messages;

  let rootId = null;
  for (const [id, n] of Object.entries(mapping)) {
    if (!n.parent) { rootId = id; break; }
  }
  if (!rootId) return messages;

  // 反復（明示スタック）で走査。再帰だと長い/深い会話でスタックオーバーフローするため。
  const stack = [{ nodeId: rootId, branchInfo: null }];
  while (stack.length > 0) {
    const { nodeId, branchInfo } = stack.pop();
    const node = mapping[nodeId];
    if (!node) continue;

    if (node.message) {
      const msg = node.message;
      const author = msg.author;
      const content = msg.content;
      const isSystem = !!(author && author.role === 'system');
      const isHidden = !!(msg.metadata && msg.metadata.is_visually_hidden_from_conversation);

      if (author) {
        let textContent = '';
        if (content && Array.isArray(content.parts)) {
          textContent = content.parts.filter(p => typeof p === 'string').join('\n');
        }
        if (textContent.trim()) {
          messages.push({
            role: author.role,
            content: textContent,
            timestamp: msg.create_time,
            isHidden: isSystem || isHidden,
            isBranch: branchInfo != null,
            branchIndex: branchInfo ? branchInfo.index : null,
            branchTotal: branchInfo ? branchInfo.total : null,
          });
        }
      }
    }

    const children = node.children || [];
    if (children.length === 1) {
      stack.push({ nodeId: children[0], branchInfo: null });
    } else if (children.length > 1) {
      // 子0が最初に処理されるよう逆順でpush（pre-order・左→右の順序を維持）
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ nodeId: children[i], branchInfo: i === 0 ? null : { index: i + 1, total: children.length } });
      }
    }
  }

  return messages;
}

function conversationText(conv) {
  const parts = [];
  const mapping = conv.mapping || {};
  for (const id in mapping) {
    const msg = mapping[id] && mapping[id].message;
    if (!msg) continue;
    const content = msg.content;
    if (content && Array.isArray(content.parts)) {
      for (const p of content.parts) if (typeof p === 'string') parts.push(p);
    }
  }
  return parts.join('\n').toLowerCase();
}

export function buildIndex(conversations) {
  const index = conversations.map(c => ({
    id: convId(c),
    title: c.title || '無題の会話',
    create_time: c.create_time,
    update_time: c.update_time,
  }));
  index.sort((a, b) => (b.update_time || 0) - (a.update_time || 0));

  const searchTexts = {};
  for (const c of conversations) {
    searchTexts[convId(c)] = (c.title || '').toLowerCase() + '\n' + conversationText(c);
  }
  return { index, searchTexts };
}

export function searchMatch(query, index, searchTexts) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return index.map(c => c.id);
  return index
    .filter(c => (searchTexts[c.id] || '').includes(q))
    .map(c => c.id);
}
