export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeUrl(url) {
  if (!url) return false;
  const u = String(url).trim().toLowerCase();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('mailto:');
}

function wrapLists(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^[-*] +\S/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^[-*] +\S/.test(lines[i])) {
        items.push('<li>' + lines[i].replace(/^[-*] +/, '') + '</li>');
        i++;
      }
      out.push('<ul>' + items.join('') + '</ul>');
    } else if (/^\d+\. +\S/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^\d+\. +\S/.test(lines[i])) {
        items.push('<li>' + lines[i].replace(/^\d+\. +/, '') + '</li>');
        i++;
      }
      out.push('<ol>' + items.join('') + '</ol>');
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join('\n');
}

export function formatContent(content) {
  if (!content) return '';
  let text = content;

  // 1. extract code blocks (random per-call token avoids collision with user text)
  const codeBlocks = [];
  const token = 'CBLK' + Math.random().toString(36).slice(2) + 'X';
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return `${token}${codeBlocks.length - 1}${token}`;
  });

  // 2. escape
  text = escapeHtml(text);

  // 3. inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. headings
  text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>')
             .replace(/^## (.*)$/gm, '<h2>$1</h2>')
             .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // 5. bold, italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 6. lists
  text = wrapLists(text);

  // 7. links (safe only). INVARIANT: this runs AFTER step 2, so `url` is already
  // HTML-escaped (any " is already &quot;, which is attribute-safe). Do NOT add
  // escapeHtml(url) here — it would double-escape & and corrupt valid URLs.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) =>
    isSafeUrl(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : `${label} (${url})`);

  // 8. line breaks
  text = text.replace(/\n/g, '<br>');

  // 9. remove extra <br> right after block elements
  text = text.replace(/(<\/(?:h[1-3]|li|ul|ol)>)<br>/g, '$1');
  text = text.replace(/(<(?:ul|ol)>)<br>/g, '$1');

  // 10. restore code blocks
  const restoreRe = new RegExp(token + '([0-9]+)' + token, 'g');
  text = text.replace(restoreRe, (m, idx) => codeBlocks[idx]);

  return text;
}
