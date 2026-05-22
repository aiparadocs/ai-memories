import { extractMessages, buildIndex, searchMatch, convId } from './lib/extract.js';
import { extractMessagesClaude, buildIndexClaude, claudeConvId } from './lib/extract-claude.js';
import { detectFormat } from './lib/format.js';

let convById = new Map();
let index = [];
let searchTexts = {};
let format = 'chatgpt';

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      const text = await msg.file.text();
      const conversations = JSON.parse(text);
      format = detectFormat(conversations);
      const idOf = format === 'claude' ? claudeConvId : convId;
      convById = new Map(conversations.map(c => [idOf(c), c]));
      const built = format === 'claude' ? buildIndexClaude(conversations) : buildIndex(conversations);
      index = built.index;
      searchTexts = built.searchTexts;
      self.postMessage({ type: 'loaded', index });
    } else if (msg.type === 'getMessages') {
      const conv = convById.get(msg.id);
      const messages = conv
        ? (format === 'claude' ? extractMessagesClaude(conv) : extractMessages(conv))
        : [];
      self.postMessage({ type: 'messages', id: msg.id, messages });
    } else if (msg.type === 'search') {
      self.postMessage({ type: 'searchResult', query: msg.query, ids: searchMatch(msg.query, index, searchTexts) });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
