// AI Memories - 会話ログビューア
import { formatContent, escapeHtml } from './lib/markdown.js';
import { nextTheme, normalizeTheme } from './lib/theme.js';

const worker = new Worker('worker.js', { type: 'module' });

let indexList = [];        // [{id, title, create_time, update_time}]（更新日時降順）
let currentMessages = [];  // 直近に取得した会話の全メッセージ（hidden含む）
let currentId = null;

// DOM
const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const aiNameInput = document.getElementById('aiNameInput');
const conversationList = document.getElementById('conversationList');
const showHiddenInput = document.getElementById('showHiddenInput');
const chatHeader = document.getElementById('chatHeader');
const chatMessages = document.getElementById('chatMessages');
const stats = document.getElementById('stats');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const themeToggle = document.getElementById('themeToggle');

// --- サイドバー（モバイル） ---
function toggleSidebar() { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('visible'); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); }
menuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// --- テーマ ---
const THEME_KEY = 'theme';
const THEME_LABELS = { auto: 'テーマ: 自動', light: 'テーマ: ライト', dark: 'テーマ: ダーク' };
function applyTheme(v) {
  if (v === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', v);
  themeToggle.textContent = THEME_LABELS[v];
}
let theme = normalizeTheme(localStorage.getItem(THEME_KEY));
applyTheme(theme);
themeToggle.addEventListener('click', () => {
  theme = nextTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

// --- 設定（名前・隠しメッセージ） ---
let aiName = localStorage.getItem('aiName') || '';
aiNameInput.value = aiName;
aiNameInput.addEventListener('input', () => {
  aiName = aiNameInput.value;
  localStorage.setItem('aiName', aiName);
  renderMessages();
});

let showHidden = localStorage.getItem('showHidden') === 'true';
showHiddenInput.checked = showHidden;
showHiddenInput.addEventListener('change', () => {
  showHidden = showHiddenInput.checked;
  localStorage.setItem('showHidden', showHidden);
  renderMessages();
});

// --- ファイル読み込み（Workerへ） ---
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  conversationList.innerHTML = '<div class="loading">読み込み中</div>';
  worker.postMessage({ type: 'load', file });
  // 同じファイルを選び直しても change が再発火するよう値をリセット
  e.target.value = '';
});

// --- Workerからの応答 ---
worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'loaded') {
    indexList = msg.index;
    searchInput.value = ''; // 新規読み込み時は検索をリセット
    renderConversationList(indexList);
    stats.textContent = `${indexList.length} 件の会話`;
  } else if (msg.type === 'messages') {
    if (msg.id !== currentId) return; // 古い応答は無視
    currentMessages = msg.messages;
    renderMessages();
  } else if (msg.type === 'searchResult') {
    if (msg.query !== searchInput.value) return; // 古い検索結果は無視
    const idset = new Set(msg.ids);
    renderConversationList(indexList.filter(c => idset.has(c.id)));
  } else if (msg.type === 'error') {
    conversationList.innerHTML = '<p class="placeholder">ファイルの読み込みに失敗しました</p>';
    console.error('Worker error:', msg.message);
  }
};

// --- 検索（150msデバウンス） ---
let searchTimer = null;
searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (!query.trim()) { renderConversationList(indexList); return; }
    worker.postMessage({ type: 'search', query });
  }, 150);
});

// --- 会話リスト描画 ---
function renderConversationList(list) {
  if (!list.length) {
    conversationList.innerHTML = '<p class="placeholder">会話が見つかりません</p>';
    return;
  }
  conversationList.innerHTML = list.map(c => {
    const ts = c.create_time || c.update_time;
    const date = ts ? formatDateFull(ts) : '';
    const title = c.title || '無題の会話';
    return `
      <div class="conversation-item" data-id="${escapeHtml(String(c.id))}">
        <div class="title">${escapeHtml(title)}</div>
        <div class="date">${date}</div>
      </div>`;
  }).join('');

  conversationList.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      selectConversation(item.dataset.id);
      closeSidebar();
      conversationList.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// --- 会話選択 ---
function selectConversation(id) {
  currentId = id;
  const conv = indexList.find(c => String(c.id) === String(id));
  const ts = conv ? (conv.create_time || conv.update_time) : null;
  const date = ts ? formatDateFull(ts) : '';
  chatHeader.innerHTML = `
    <h2>${escapeHtml((conv && conv.title) || '無題の会話')}</h2>
    <span class="chat-date">${date}</span>`;
  chatMessages.innerHTML = '<div class="loading">読み込み中</div>';
  worker.postMessage({ type: 'getMessages', id });
}

// --- ブロック描画（Claude形式: blocks を持つメッセージ用） ---
function renderBody(msg) {
  if (Array.isArray(msg.blocks)) return renderBlocks(msg.blocks);
  return formatContent(msg.content);
}

function renderBlocks(blocks) {
  return blocks.map(b => {
    if (b.type === 'text') return formatContent(b.text);
    if (b.type === 'thinking') {
      return `<details class="thinking"><summary>思考</summary><div class="thinking-body">${formatContent(b.text)}</div></details>`;
    }
    if (b.type === 'tool_use') {
      const msgLine = b.message ? `<div class="tool-msg">${escapeHtml(b.message)}</div>` : '';
      const input = b.input !== undefined ? `<pre><code>${escapeHtml(JSON.stringify(b.input, null, 2))}</code></pre>` : '';
      return `<div class="tool-use"><span class="block-label">ツール: ${escapeHtml(b.name)}</span>${msgLine}${input}</div>`;
    }
    if (b.type === 'tool_result') {
      return `<div class="tool-result${b.isError ? ' error' : ''}"><span class="block-label">結果</span><div>${formatContent(b.text)}</div></div>`;
    }
    if (b.type === 'attachment') {
      const ft = b.fileType ? `（${escapeHtml(b.fileType)}）` : '';
      return `<div class="attachment"><span class="block-label">添付: ${escapeHtml(b.fileName || '(名称なし)')}${ft}</span><div>${formatContent(b.text)}</div></div>`;
    }
    if (b.type === 'file') {
      return `<div class="file-ref">[ファイル: ${escapeHtml(b.fileName)}]</div>`;
    }
    return '';
  }).join('');
}

// --- メッセージ描画（showHiddenで絞り込み） ---
function renderMessages() {
  const messages = showHidden ? currentMessages : currentMessages.filter(m => !m.isHidden);
  if (!messages.length) {
    chatMessages.innerHTML = `<div class="welcome-message"><p>この会話にはメッセージがありません</p></div>`;
    return;
  }
  chatMessages.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const time = msg.timestamp ? formatDateTime(msg.timestamp) : '';
    if (isUser) {
      const branchClass = msg.isBranch ? 'branch-message' : '';
      return `
        <div class="message user ${branchClass}">
          ${msg.isBranch ? `<span class="branch-badge">Branch ${msg.branchIndex}/${msg.branchTotal}</span>` : ''}
          <div class="message-bubble">${renderBody(msg)}</div>
          <div class="message-time">${time}</div>
        </div>`;
    }
    const nameHtml = aiName ? `<span class="message-role">${escapeHtml(aiName)}</span>` : '';
    const hiddenClass = msg.isHidden ? 'hidden-message' : '';
    const branchClass = msg.isBranch ? 'branch-message' : '';
    return `
      <div class="message assistant ${hiddenClass} ${branchClass}">
        <div class="message-body">
          <div class="message-meta">
            ${nameHtml}
            <span class="message-time">${time}</span>
            ${msg.isHidden ? '<span class="hidden-badge">Hidden</span>' : ''}
            ${msg.isBranch ? `<span class="branch-badge">Branch ${msg.branchIndex}/${msg.branchTotal}</span>` : ''}
          </div>
          <div class="message-content">${renderBody(msg)}</div>
        </div>
      </div>`;
  }).join('');
  chatMessages.scrollTop = 0;
}

// --- 日付フォーマット ---
function formatDateFull(timestamp) {
  const d = new Date(timestamp * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}年${m}月${day}日`;
}
function formatDateTime(timestamp) {
  const d = new Date(timestamp * 1000);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}
