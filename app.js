// AI Memories - 会話ログビューア

let conversations = [];
let currentConversation = null;

// DOM要素
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

// モバイルメニュー切り替え
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('visible');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

menuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// 名前の設定（localStorageから復元）
let aiName = localStorage.getItem('aiName') || '';
aiNameInput.value = aiName;

// 名前変更時
aiNameInput.addEventListener('input', () => {
    aiName = aiNameInput.value;
    localStorage.setItem('aiName', aiName);
    // 現在の会話を再描画
    if (currentConversation) {
        const messages = extractMessages(currentConversation);
        renderMessages(messages);
    }
    if (currentConversation) {
        const messages = extractMessages(currentConversation);
        renderMessages(messages);
    }
});

// 隠しメッセージ表示設定
let showHidden = localStorage.getItem('showHidden') === 'true';
showHiddenInput.checked = showHidden;

showHiddenInput.addEventListener('change', () => {
    showHidden = showHiddenInput.checked;
    localStorage.setItem('showHidden', showHidden);
    // 現在の会話を再描画
    if (currentConversation) {
        const messages = extractMessages(currentConversation);
        renderMessages(messages);
    }
});

// ファイル読み込み
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    conversationList.innerHTML = '<div class="loading">読み込み中</div>';

    try {
        // UTF-8として明示的に読み込み
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        conversations = JSON.parse(text);

        // 日付でソート（新しい順）
        conversations.sort((a, b) => (b.update_time || 0) - (a.update_time || 0));

        renderConversationList(conversations);
        stats.textContent = `${conversations.length} 件の会話`;
    } catch (error) {
        console.error('Error loading file:', error);
        conversationList.innerHTML = '<p class="placeholder">ファイルの読み込みに失敗しました</p>';
    }
});

// 検索
searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();

    if (!query) {
        renderConversationList(conversations);
        return;
    }

    const filtered = conversations.filter(conv => {
        if (conv.title && conv.title.toLowerCase().includes(query)) {
            return true;
        }
        const messages = extractMessages(conv);
        return messages.some(msg =>
            msg.content && msg.content.toLowerCase().includes(query)
        );
    });

    renderConversationList(filtered);
});

// 会話リストを描画
function renderConversationList(convs) {
    if (convs.length === 0) {
        conversationList.innerHTML = '<p class="placeholder">会話が見つかりません</p>';
        return;
    }

    conversationList.innerHTML = convs.map((conv) => {
        const timestamp = conv.create_time || conv.update_time;
        const date = timestamp ? formatDateFull(timestamp) : '';
        const title = conv.title || '無題の会話';

        return `
            <div class="conversation-item" data-index="${conversations.indexOf(conv)}">
                <div class="title">${escapeHtml(title)}</div>
                <div class="date">${date}</div>
            </div>
        `;
    }).join('');

    // クリックイベント
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            selectConversation(index);
            closeSidebar(); // モバイルでサイドバーを閉じる

            // アクティブ状態を更新
            document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// 会話を選択
function selectConversation(index) {
    const conv = conversations[index];
    if (!conv) return;

    currentConversation = conv;

    // ヘッダー更新（日付付き）
    const timestamp = conv.create_time || conv.update_time;
    const date = timestamp ? formatDateFull(timestamp) : '';
    chatHeader.innerHTML = `
        <h2>${escapeHtml(conv.title || '無題の会話')}</h2>
        <span class="chat-date">${date}</span>
    `;

    // メッセージを抽出して表示
    const messages = extractMessages(conv);
    renderMessages(messages);
}

// ChatGPTのエクスポート形式からメッセージを抽出（全分岐対応）
function extractMessages(conv) {
    const messages = [];
    const mapping = conv.mapping;

    if (!mapping) return messages;

    // ルートノードを見つける
    let rootId = null;
    for (const [id, node] of Object.entries(mapping)) {
        if (!node.parent) {
            rootId = id;
            break;
        }
    }

    if (!rootId) return messages;

    // ツリーを辿ってメッセージを収集（全分岐対応）
    function traverse(nodeId, branchInfo = null) {
        const node = mapping[nodeId];
        if (!node) return;

        // メッセージがあれば追加
        if (node.message) {
            const msg = node.message;
            const author = msg.author;
            const content = msg.content;

            // システムメッセージやhiddenは除外（設定で表示可能に）
            const isSystem = author && author.role === 'system';
            const isHidden = msg.metadata?.is_visually_hidden_from_conversation;

            if ((author && !isSystem && !isHidden) || showHidden) {

                let textContent = '';
                if (content && content.parts) {
                    textContent = content.parts
                        .filter(part => typeof part === 'string')
                        .join('\n');
                }

                if (textContent.trim()) {
                    messages.push({
                        role: author.role,
                        content: textContent,
                        timestamp: msg.create_time,
                        isHidden: isSystem || isHidden,
                        isBranch: branchInfo !== null,
                        branchIndex: branchInfo ? branchInfo.index : null,
                        branchTotal: branchInfo ? branchInfo.total : null
                    });
                }
            }
        }

        // 子ノードを辿る（全ての分岐を辿る）
        if (node.children && node.children.length > 0) {
            const children = node.children;

            if (children.length === 1) {
                // 分岐なし：そのまま辿る
                traverse(children[0], null);
            } else {
                // 分岐あり：全ての子を辿る
                children.forEach((childId, index) => {
                    const childBranchInfo = {
                        index: index + 1,
                        total: children.length
                    };
                    traverse(childId, index === 0 ? null : childBranchInfo);
                });
            }
        }
    }

    traverse(rootId);
    return messages;
}

// メッセージを描画
function renderMessages(messages) {
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <p>この会話にはメッセージがありません</p>
            </div>
        `;
        return;
    }

    chatMessages.innerHTML = messages.map(msg => {
        const isUser = msg.role === 'user';
        const time = msg.timestamp ? formatDateTime(msg.timestamp) : '';

        if (isUser) {
            // ユーザーメッセージ（右寄せ、バブル）
            const branchClass = msg.isBranch ? 'branch-message' : '';
            return `
                <div class="message user ${branchClass}">
                    ${msg.isBranch ? `<span class="branch-badge">Branch ${msg.branchIndex}/${msg.branchTotal}</span>` : ''}
                    <div class="message-bubble">${formatContent(msg.content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        } else {
            // 相手メッセージ（左寄せ）
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
                        <div class="message-content">${formatContent(msg.content)}</div>
                    </div>
                </div>
            `;
        }
    }).join('');

    // スクロールを一番上に
    chatMessages.scrollTop = 0;
}

// コンテンツをフォーマット
// コンテンツをフォーマット（簡易Markdown）
function formatContent(content) {
    if (!content) return '';

    // HTMLエスケープ（コードブロック以外）
    let text = content;

    // コードブロックを一時退避
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // エスケープ処理
    text = escapeHtml(text);

    // インラインコード
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 見出し
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // 太字
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // イタリック
    text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // リスト（簡易）
    text = text.replace(/^\- (.*$)/gm, '<li>$1</li>');
    // リストのラップ処理（連続するliをulで囲むのは簡易実装では省略し、CSSで調整）

    // リンク
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // 改行を<br>に（ただしHTMLタグの後は除く）
    text = text.replace(/\n/g, '<br>');

    // 見出しやリストの後の余分な<br>を削除
    text = text.replace(/(<\/h[1-3]>|<\/li>)<br>/g, '$1');

    // コードブロックを復帰
    text = text.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => codeBlocks[index]);

    return text;
}

// HTMLエスケープ
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット（簡易）
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}/${month}/${day}`;
}

// 日付フォーマット（詳細）
function formatDateFull(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 日時フォーマット（時刻付き）
function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}
