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

  // 1. extract code blocks
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return ` CB${codeBlocks.length - 1} `;
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

  // 7. links (safe only)
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
  text = text.replace(/ CB(\d+) /g, (m, idx) => codeBlocks[idx]);

  return text;
}
