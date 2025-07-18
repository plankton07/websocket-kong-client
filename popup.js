import { isValidJSON, formatJSON } from './helpers.js';
import { saveMessage } from './history.js';

const MESSAGE_TYPE = {
    SENT: 'sent',
    RECEIVED: 'received',
    ERROR: 'error'
};

document.addEventListener('DOMContentLoaded', async () => {
    let sessionCounter = 0;
    const sessions = {};

    const tabButtons = document.getElementById('tab-buttons');
    const sessionsContainer = document.getElementById('sessions');
    const addSessionBtn = document.getElementById('add-session');

    // 복원: chrome.storage.local에서 세션 데이터 불러오기
    await restoreSessions();

    addSessionBtn.addEventListener('click', addSession);

    function addSession(sessionData) {
        const id = sessionData?.id || `session-${sessionCounter++}`;
        sessions[id] = {
            socket: null,
            url: sessionData?.url || "",
            messages: sessionData?.messages || [""],
            activeTab: sessionData?.activeTab || 0,
            savedMessages: sessionData?.savedMessages || []
        };

        // session tab button
        const button = document.createElement('button');
        button.textContent = id;
        button.addEventListener('click', () => {
            // 항상 최신 active 상태를 기준으로 동작
            if (button.classList.contains('active')) {
                removeSession(id, button);
            } else {
                selectSession(id);
            }
        });
        tabButtons.appendChild(button);

        // session UI
        const div = document.createElement('div');
        div.className = 'session';
        div.id = id;
        div.style.display = 'none';
        div.innerHTML = getSessionInnerHTML(id);
        sessionsContainer.appendChild(div);

        document.getElementById(`${id}-connect`).addEventListener('click', () => connect(id));
        document.getElementById(`${id}-send`).addEventListener('click', () => send(id));
        document.getElementById(`${id}-save-message`).addEventListener('click', () => saveCurrentMessage(id));
        document.getElementById(`${id}-url`).value = sessions[id].url;

        document.getElementById(`${id}-url`).addEventListener('input', (e) => {
            sessions[id].url = e.target.value;
            saveAllSessions();
        });

        document.getElementById(`${id}-clear-log`).addEventListener('click', () => {
            const logArea = document.getElementById(`${id}-log`);
            if (logArea) logArea.innerHTML = '';
        });

        setupTabEvents(id);
        setupJSONHighlight(id);
        selectSession(id);

        // 메시지 탭 및 textarea 복원
        restoreTabsAndTextarea(id);

        saveAllSessions();
    }

    function restoreTabsAndTextarea(id) {
        const session = sessions[id];
        const tabList = document.getElementById(`${id}-tabs`);
        // 기존 탭 삭제 (#1만 남기고)
        Array.from(tabList.querySelectorAll('.message-tab')).slice(1).forEach(btn => btn.remove());
        // 탭 추가
        for (let i = 1; i < session.messages.length; i++) {
            const newTab = document.createElement('button');
            newTab.className = 'message-tab';
            newTab.dataset.tab = i;
            newTab.textContent = `#${i + 1}`;
            newTab.onclick = () => {
                if (newTab.classList.contains('active')) {
                    removeMessageTab(id, i);
                } else {
                    switchMessageTab(id, i);
                }
            };
            tabList.insertBefore(newTab, document.getElementById(`${id}-add-tab`));
        }
        switchMessageTab(id, session.activeTab);
    }

    function removeSession(id, button) {
        // Remove session area from DOM
        const sessionDiv = document.getElementById(id);
        if (sessionDiv) sessionDiv.remove();
        // Remove session object
        delete sessions[id];
        // Remove tab button
        button.remove();

        // If there are remaining sessions, select the first one
        const remainingButtons = tabButtons.querySelectorAll('button');
        if (remainingButtons.length > 0) {
            const nextId = remainingButtons[0].textContent;
            selectSession(nextId);
        }
        saveAllSessions();
    }

    function getSessionInnerHTML(id) {
        return `
<div class="session-body">
    <div class="saved-panel">
      <h3>Saved Messages</h3>
      <div id="${id}-saved-list" class="saved-message-list"></div>
    </div>
    <div class="editor-panel">
      <div class="connect-row">
        <input id="${id}-url" type="text" placeholder="ws://localhost:8080" />
        <button id="${id}-connect">Connect</button>
      </div>
      <div class="message-tabs" id="${id}-tabs">
        <button class="message-tab active" data-tab="0">#1</button>
        <button class="add-tab" id="${id}-add-tab">＋</button>
      </div>
      <div class="editor-container">
        <textarea id="${id}-message" class="message-input" placeholder="Enter JSON message"></textarea>
        <pre id="${id}-json-viewer" class="json-viewer"></pre>
        <div class="button-group">
          <button id="${id}-send">Send</button>
          <button id="${id}-save-message">Save</button>
          <button id="${id}-clear-log" class="log-clear-btn">Clear-Log</button>
        </div>
      </div>
      <div id="${id}-log" class="log-area"></div>
    </div>
</div>
`;
    }

    function setupTabEvents(id) {
        const session = sessions[id];
        const tabList = document.getElementById(`${id}-tabs`);
        tabList.querySelectorAll('.message-tab').forEach((btn, idx) => {
            btn.onclick = () => {
                if (btn.classList.contains('active')) {
                    removeMessageTab(id, idx);
                } else {
                    switchMessageTab(id, idx);
                }
            };
        });
        document.getElementById(`${id}-add-tab`).addEventListener('click', () => {
            session.messages.push("");
            const tabList = document.getElementById(`${id}-tabs`);
            const newIndex = tabList.querySelectorAll('.message-tab').length;
            const newTab = document.createElement('button');
            newTab.className = 'message-tab';
            newTab.dataset.tab = newIndex;
            newTab.textContent = `#${newIndex + 1}`;
            newTab.onclick = () => {
                if (newTab.classList.contains('active')) {
                    removeMessageTab(id, newIndex);
                } else {
                    switchMessageTab(id, newIndex);
                }
            };
            tabList.insertBefore(newTab, document.getElementById(`${id}-add-tab`));
            switchMessageTab(id, newIndex);
            saveAllSessions();
        });
    }

    function removeMessageTab(id, tabIndex) {
        const session = sessions[id];
        if (session.messages.length === 1) return; // Always keep at least one

        // Remove message and tab button
        session.messages.splice(tabIndex, 1);
        const tabList = document.getElementById(`${id}-tabs`);
        const tabBtn = tabList.querySelector(`.message-tab[data-tab="${tabIndex}"]`);
        if (tabBtn) tabBtn.remove();

        // Re-index remaining tabs and re-register events
        Array.from(tabList.querySelectorAll('.message-tab')).forEach((btn, idx) => {
            btn.dataset.tab = idx;
            btn.textContent = `#${idx + 1}`;
            btn.onclick = () => {
                if (btn.classList.contains('active')) {
                    removeMessageTab(id, idx);
                } else {
                    switchMessageTab(id, idx);
                }
            };
        });

        // Adjust activeTab
        session.activeTab = Math.max(0, tabIndex - 1);
        switchMessageTab(id, session.activeTab);
        saveAllSessions();
    }

    function switchMessageTab(id, tabIndex) {
        const session = sessions[id];
        const textarea = document.getElementById(`${id}-message`);
        session.messages[session.activeTab] = textarea.value;
        session.activeTab = tabIndex;
        textarea.value = session.messages[tabIndex];
        document.querySelectorAll(`#${id}-tabs .message-tab`).forEach(btn => btn.classList.remove('active'));
        const newActive = document.querySelector(`#${id}-tabs .message-tab[data-tab="${tabIndex}"]`);
        if (newActive) newActive.classList.add('active');
        textarea.dispatchEvent(new Event('input'));
        saveAllSessions();
    }

    function connect(id) {
        const connectBtn = document.getElementById(`${id}-connect`);
        const urlInput = document.getElementById(`${id}-url`);
        const session = sessions[id];

        if (session.socket && session.socket.readyState === WebSocket.OPEN) {
            session.socket.close();
            connectBtn.textContent = 'Connect';
            session.socket = null;
            logMessage(id, 'Disconnected');
            return;
        }

        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a WebSocket URL.');
            return;
        }

        try {
            const ws = new WebSocket(url);
            session.socket = ws;

            ws.onopen = () => {
                connectBtn.textContent = 'Disconnect';
                logMessage(id, `Connected to ${url}`);
            };
            ws.onmessage = (event) => logMessage(id, event.data, MESSAGE_TYPE.RECEIVED);
            ws.onclose = () => {
                connectBtn.textContent = 'Connect';
                logMessage(id, 'Disconnected');
                session.socket = null;
            };
            ws.onerror = (error) => logMessage(id, `Error: ${error.message || error}`);
        } catch (err) {
            alert('An error occurred while connecting: ' + err.message);
        }
    }

    function logMessage(id, message, type = 'info') {
        const logArea = document.getElementById(`${id}-log`);
        if (!logArea) return;

        const time = new Date();
        const timestamp = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')} ${time.getMonth() + 1}.${time.getDate()}`;

        const container = document.createElement('div');
        container.className = 'log-entry';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = `[${timestamp}] `;

        const msgSpan = document.createElement('span');
        msgSpan.className = `log-${type}`;
        msgSpan.textContent = `[${type.charAt(0).toUpperCase() + type.slice(1)}] ${message}`;

        container.appendChild(timeSpan);
        container.appendChild(msgSpan);

        if (type === MESSAGE_TYPE.RECEIVED) {
            container.appendChild(createCopyButton(() => message));
        }

        logArea.appendChild(container);
        logArea.scrollTop = logArea.scrollHeight;

        if (type === MESSAGE_TYPE.SENT || type === MESSAGE_TYPE.RECEIVED) {
            saveMessage(id, {
                time: new Date().toISOString(),
                type,
                msg: message
            });
        }
    }

    function createCopyButton(getValueFn) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'copy';
        copyBtn.innerHTML = '📋';

        copyBtn.addEventListener('click', () => {
            const valueToCopy = typeof getValueFn === 'function' ? getValueFn() : getValueFn;
            navigator.clipboard.writeText(valueToCopy).then(() => {
                copyBtn.innerHTML = '✅';
                setTimeout(() => copyBtn.innerHTML = '📋', 1000);
            }).catch(() => {
                copyBtn.innerHTML = '❌';
                setTimeout(() => copyBtn.innerHTML = '📋', 1000);
            });
        });

        return copyBtn;
    }

    function selectSession(id) {
        document.querySelectorAll('.session').forEach(el => (el.style.display = 'none'));
        const selected = document.getElementById(id);
        if (selected) selected.style.display = 'block';

        document.querySelectorAll('#tab-buttons button').forEach(btn => btn.classList.remove('active'));
        const activeBtn = Array.from(document.querySelectorAll('#tab-buttons button')).find(btn => btn.textContent === id);
        if (activeBtn) activeBtn.classList.add('active');
        renderSavedMessages(id);

        // Restore URL and textarea when switching sessions
        document.getElementById(`${id}-url`).value = sessions[id].url;
        const textarea = document.getElementById(`${id}-message`);
        textarea.value = sessions[id].messages[sessions[id].activeTab];
    }

    function send(id) {
        const input = document.getElementById(`${id}-message`);
        const socket = sessions[id].socket;
        const msg = input.value;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            logMessage(id, 'WebSocket is not open.', MESSAGE_TYPE.RECEIVED);
            return;
        }

        socket.send(msg);
        const formatted = isValidJSON(msg) ? formatJSON(msg) : msg;
        logMessage(id, formatted, MESSAGE_TYPE.SENT);
    }

    function saveCurrentMessage(id) {
        const input = document.getElementById(`${id}-message`);
        const msg = input.value.trim();
        if (!msg) return;

        sessions[id].savedMessages.push(msg);
        renderSavedMessages(id);
        saveAllSessions();
    }

    function renderSavedMessages(id) {
        const container = document.getElementById(`${id}-saved-list`);
        const messages = sessions[id].savedMessages;
        if (!container) return;

        container.innerHTML = '';

        messages.forEach((msg, index) => {
            const row = document.createElement('div');
            row.className = 'saved-message-item';

            const snippet = document.createElement('span');
            snippet.textContent = msg.length > 60 ? msg.slice(0, 60) + '...' : msg;
            snippet.title = msg; // Show full message on hover

            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'saved-message-copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                const input = document.getElementById(`${id}-message`);
                input.value = msg;
                input.dispatchEvent(new Event('input'));
            });

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'saved-message-del-btn';
            delBtn.textContent = 'Del';
            delBtn.title = 'Delete this message';
            delBtn.addEventListener('click', () => {
                sessions[id].savedMessages.splice(index, 1);
                renderSavedMessages(id);
                saveAllSessions();
            });

            row.appendChild(snippet);
            row.appendChild(copyBtn);
            row.appendChild(delBtn);
            container.appendChild(row);
        });
    }

    function syntaxHighlight(json) {
        if (!json) return '';
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(
            /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d*)?([eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = 'number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'key' : 'string';
                } else if (/true|false/.test(match)) {
                    cls = 'boolean';
                } else if (/null/.test(match)) {
                    cls = 'null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    function setupJSONHighlight(id) {
        const input = document.getElementById(`${id}-message`);
        const viewer = document.getElementById(`${id}-json-viewer`);

        // Always copy the latest input.value using callback
        const copyBtn = createCopyButton(() => input.value.trim());

        viewer.style.position = 'relative';
        viewer.appendChild(copyBtn);

        input.addEventListener('input', () => {
            const val = input.value.trim();
            sessions[id].messages[sessions[id].activeTab] = val;
            saveAllSessions();
            if (!val) {
                viewer.innerHTML = '';
                viewer.appendChild(copyBtn);
                return;
            }
            try {
                const parsed = JSON.parse(val);
                const formatted = JSON.stringify(parsed, null, 2);
                viewer.innerHTML = syntaxHighlight(formatted);
                viewer.appendChild(copyBtn);
            } catch {
                viewer.textContent = 'Invalid JSON.';
                viewer.appendChild(copyBtn);
            }
        });
    }

    // Save all sessions to chrome.storage.local
    function saveAllSessions() {
        const data = Object.entries(sessions).map(([id, s]) => ({
            id,
            url: document.getElementById(`${id}-url`)?.value || s.url || "",
            messages: s.messages,
            activeTab: s.activeTab,
            savedMessages: s.savedMessages
        }));
        if (window.chrome?.storage?.local) {
            chrome.storage.local.set({ websocketKongSessions: data });
        } else {
            localStorage.setItem('websocketKongSessions', JSON.stringify(data));
        }
    }

    // Restore all sessions from chrome.storage.local
    async function restoreSessions() {
        return new Promise((resolve) => {
            if (window.chrome?.storage?.local) {
                chrome.storage.local.get(['websocketKongSessions'], (result) => {
                    const arr = result.websocketKongSessions || [];
                    arr.forEach(sessionData => {
                        addSession(sessionData);
                    });
                    sessionCounter = arr.length;
                    resolve();
                });
            } else {
                // fallback for non-extension environments
                const arr = JSON.parse(localStorage.getItem('websocketKongSessions') || '[]');
                arr.forEach(sessionData => {
                    addSession(sessionData);
                });
                sessionCounter = arr.length;
                resolve();
            }
        });
    }
});