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

  function traverse(nodeId, branchInfo) {
    const node = mapping[nodeId];
    if (!node) return;

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
      traverse(children[0], null);
    } else if (children.length > 1) {
      children.forEach((childId, i) => {
        traverse(childId, i === 0 ? null : { index: i + 1, total: children.length });
      });
    }
  }

  traverse(rootId, null);
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
