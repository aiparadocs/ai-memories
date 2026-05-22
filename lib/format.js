export function detectFormat(conversations) {
  const c = Array.isArray(conversations) ? conversations[0] : null;
  if (c && c.chat_messages) return 'claude';
  return 'chatgpt';
}
