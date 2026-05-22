import { extractMessages, buildIndex, searchMatch, convId } from './lib/extract.js';

let convById = new Map();
let index = [];
let searchTexts = {};

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      const text = await msg.file.text();
      const conversations = JSON.parse(text);
      convById = new Map(conversations.map(c => [convId(c), c]));
      const built = buildIndex(conversations);
      index = built.index;
      searchTexts = built.searchTexts;
      self.postMessage({ type: 'loaded', index });
    } else if (msg.type === 'getMessages') {
      const conv = convById.get(msg.id);
      self.postMessage({ type: 'messages', id: msg.id, messages: conv ? extractMessages(conv) : [] });
    } else if (msg.type === 'search') {
      self.postMessage({ type: 'searchResult', query: msg.query, ids: searchMatch(msg.query, index, searchTexts) });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
