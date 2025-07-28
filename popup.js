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
    const sessionTabs = document.getElementById('session-tabs');
    const sessionsContainer = document.getElementById('sessions');
    const addSessionBtn = document.getElementById('add-session');

    window.addEventListener('beforeunload', () => {
        const emptyAddSessionBtn = document.getElementById('empty-add-session');
        if (emptyAddSessionBtn) {
            emptyAddSessionBtn.addEventListener('click', () => {
                const newId = addSession();
                selectSession(newId);
            });
        }

        const activeSessionTab = document.querySelector('.session-tab.active');
        if (activeSessionTab) {
            const id = activeSessionTab.dataset.id;
            const textarea = document.getElementById(`${id}-message`);
            if (textarea && sessions[id]) {
                sessions[id].messages[sessions[id].activeTab] = textarea.value;
            }
        }
        saveAllSessions();
    });

    await restoreSessions();

    updateEmptyTitle();

    addSessionBtn.addEventListener('click', () => {
        const newId = addSession();
        selectSession(newId);
    });

    function renderSessionTabs(activeId = null) {
        sessionTabs.innerHTML = '';
        Object.keys(sessions).forEach(id => {
            const tab = document.createElement('div');
            tab.className = 'session-tab' + (id === activeId ? ' active' : '');
            tab.dataset.id = id;
            tab.textContent = id;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Close this session';

            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSession(id);
            });

            tab.appendChild(closeBtn);

            tab.addEventListener('click', () => {
                if (!tab.classList.contains('active')) {
                    selectSession(id);
                }
            });

            sessionTabs.appendChild(tab);
        });
        updateEmptyTitle();
    }

    function addSession(sessionData) {
        const id = sessionData?.id ?? `session-${sessionCounter++}`;
        sessions[id] = {
            socket: null,
            url: sessionData?.url || "",
            messages: sessionData?.messages || [""],
            activeTab: sessionData?.activeTab || 0,
            savedMessages: sessionData?.savedMessages || []
        };

        const div = document.createElement('div');
        div.className = 'session';
        div.id = id;
        div.style.display = 'none';
        div.innerHTML = getSessionInnerHTML(id);
        sessionsContainer.appendChild(div);

        document.getElementById(`${id}-connect`).addEventListener('click', () => connect(id));
        document.getElementById(`${id}-send`).addEventListener('click', () => send(id));
        document.getElementById(`${id}-save-message`).addEventListener('click', () => saveCurrentMessage(id));
        document.getElementById(`${id}-clear-log`).addEventListener('click', () => {
            const logArea = document.getElementById(`${id}-log`);
            if (logArea) logArea.innerHTML = '';
        });
        document.getElementById(`${id}-url`).value = sessions[id].url;
        document.getElementById(`${id}-url`).addEventListener('input', (e) => {
            sessions[id].url = e.target.value;
        });

        setupMessageTabEvents(id);

        renderSessionTabs(id);

        const textarea = document.getElementById(`${id}-message`);
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                const val = textarea.value;
                try {
                    if (val.trim() !== "") {
                        const parsed = JSON.parse(val);
                        const formatted = JSON.stringify(parsed, null, 2);  if (val !== formatted) {
                            textarea.value = formatted;
                        }

                        textarea.classList.remove('json-error');
                    } else {
                        textarea.classList.remove('json-error');
                    }
                } catch {
                    textarea.classList.add('json-error');
                }

                sessions[id].messages[sessions[id].activeTab] = textarea.value;
                saveAllSessions();
            });
        }

        const copyBtn = document.getElementById(`${id}-copy-message`);
        if (copyBtn && textarea) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    copyBtn.innerHTML = '✅';
                    setTimeout(() => copyBtn.innerHTML = '📋', 1000);
                }).catch(() => {
                    copyBtn.innerHTML = '❌';
                    setTimeout(() => copyBtn.innerHTML = '📋', 1000);
                });
            });
        }

        setupSavedMessagesExportImport(id);
        updateEmptyTitle();

        return id;
    }

    function removeSession(id) {
        const sessionDiv = document.getElementById(id);
        if (sessionDiv) sessionDiv.remove();
        delete sessions[id];

        const ids = Object.keys(sessions);
        renderSessionTabs(ids[0]);
        if (ids.length > 0) {
            selectSession(ids[0]);
        }
        saveAllSessions();
        updateEmptyTitle();
    }

    function selectSession(id) {
        const prevActive = document.querySelector('.session-tab.active');
        if (prevActive) {
            const prevId = prevActive.dataset.id;
            const prevTextarea = document.getElementById(`${prevId}-message`);
            if (prevTextarea && sessions[prevId]) {
                sessions[prevId].messages[sessions[prevId].activeTab] = prevTextarea.value;
            }
        }

        renderSessionTabs(id);
        document.querySelectorAll('.session').forEach(el => (el.style.display = 'none'));
        const selected = document.getElementById(id);
        if (selected) selected.style.display = 'block';

        renderSavedMessages(id);

        document.getElementById(`${id}-url`).value = sessions[id].url;
        renderMessageTabs(id);

        const textarea = document.getElementById(`${id}-message`);
        if (textarea) {
            textarea.value = sessions[id].messages[sessions[id].activeTab] || "";
            textarea.dispatchEvent(new Event('input'));
        }
    }

    function getSessionInnerHTML(id) {
        return `
<div class="session-body">
    <div class="saved-panel">
      <h3>Saved Messages</h3>
      <div style="display:flex;gap:4px;margin-bottom:4px;">
        <button id="${id}-export-saved" class="saved-export-btn">Export</button>
        <button id="${id}-import-saved" class="saved-import-btn">Import</button>
        <input type="file" id="${id}-import-file" accept=".json" style="display:none"/>
      </div>
      <div id="${id}-saved-list" class="saved-message-list"></div>
    </div>
    <div class="editor-panel">
      <div class="connect-row">
        <input id="${id}-url" type="text" placeholder="ws://localhost:8080" />
        <button id="${id}-connect">Connect</button>
      </div>
      <div style="display: flex; align-items: center;">
        <div class="message-tabs" id="${id}-tabs"></div>
        <button class="add-tab add-message-btn" id="${id}-add-tab" title="Add message tab" style="margin-left: 12px;">+ Message</button>
      </div>
      <div class="editor-container">
        <div class="json-input-wrapper" style="position:relative;">
          <textarea id="${id}-message" class="message-input" placeholder="Enter JSON message"></textarea>
          <button id="${id}-copy-message" class="copy-btn" title="Copy">📋</button>
        </div>
        <div class="button-group">
          <button id="${id}-send">Send</button>
          <button id="${id}-save-message">Save</button>
          <button id="${id}-clear-log" class="log-clear-btn">Clear</button>
        </div>
      </div>
      <div id="${id}-log" class="log-area"></div>
    </div>
</div>
`;
    }

    function setupSavedMessagesExportImport(id) {
        const exportBtn = document.getElementById(`${id}-export-saved`);
        exportBtn.addEventListener('click', () => {
            const data = sessions[id].savedMessages || [];
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${id}-saved-messages.json`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        });

        const importBtn = document.getElementById(`${id}-import-saved`);
        const fileInput = document.getElementById(`${id}-import-file`);
        importBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const arr = JSON.parse(evt.target.result);
                    if (Array.isArray(arr)) {
                        sessions[id].savedMessages = arr;
                        renderSavedMessages(id);
                        saveAllSessions();
                        alert('Saved Messages imported!');
                    } else {
                        alert('Invalid file format.');
                    }
                } catch (err) {
                    alert('Failed to import: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    function renderMessageTabs(id) {
        const session = sessions[id];
        const tabList = document.getElementById(`${id}-tabs`);
        tabList.innerHTML = '';
        session.messages.forEach((msg, idx) => {
            const tab = document.createElement('div');
            tab.className = 'message-tab' + (idx === session.activeTab ? ' active' : '');
            tab.textContent = `#${idx + 1}`;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Close this message tab';

            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeMessageTab(id, idx);
            });

            tab.appendChild(closeBtn);

            tab.addEventListener('click', () => {
                if (!tab.classList.contains('active')) {
                    switchMessageTab(id, idx);
                }
            });

            tabList.appendChild(tab);
        });
    }

    function setupMessageTabEvents(id) {
        document.getElementById(`${id}-add-tab`).addEventListener('click', () => {
            sessions[id].messages.push("");
            renderMessageTabs(id);
            switchMessageTab(id, sessions[id].messages.length - 1);
            saveAllSessions();
        });
    }

    function removeMessageTab(id, tabIndex) {
        const session = sessions[id];
        if (session.messages.length === 1) return;

        session.messages.splice(tabIndex, 1);

        if (session.activeTab >= session.messages.length) {
            session.activeTab = session.messages.length - 1;
        }
        renderMessageTabs(id);
        switchMessageTab(id, session.activeTab);
    }

    function switchMessageTab(id, tabIndex) {
        const session = sessions[id];
        const textarea = document.getElementById(`${id}-message`);
        if (!textarea) return;

        session.messages[session.activeTab] = textarea.value;

        session.activeTab = tabIndex;

        textarea.value = session.messages[tabIndex] || "";

        renderMessageTabs(id);

        textarea.dispatchEvent(new Event('input'));
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

        logArea.insertBefore(container, logArea.firstChild);

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
            snippet.title = msg;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'saved-message-copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                const input = document.getElementById(`${id}-message`);
                input.value = msg;
                input.dispatchEvent(new Event('input'));
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'saved-message-del-btn';
            delBtn.textContent = 'Del';
            delBtn.title = 'Delete this message';
            delBtn.addEventListener('click', () => {
                sessions[id].savedMessages.splice(index, 1);
                renderSavedMessages(id);
            });

            row.appendChild(snippet);
            row.appendChild(copyBtn);
            row.appendChild(delBtn);
            container.appendChild(row);
        });
    }

    function saveCurrentMessage(id) {
        const input = document.getElementById(`${id}-message`);
        const msg = input.value.trim();
        if (!msg) return;

        sessions[id].savedMessages.push(msg);
        renderSavedMessages(id);
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

        const copyBtn = createCopyButton(() => input.value.trim());

        viewer.style.position = 'relative';
        viewer.appendChild(copyBtn);

        input.addEventListener('input', () => {
            const val = input.value;
            sessions[id].messages[sessions[id].activeTab] = val;
            if (!val.trim()) {
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

    function saveAllSessions() {
        const data = Object.entries(sessions).map(([id, s]) => ({
            id,
            url: document.getElementById(`${id}-url`)?.value || s.url || "",
            messages: s.messages,
            activeTab: s.activeTab,
            savedMessages: s.savedMessages
        }));

        const activeSessionTab = document.querySelector('.session-tab.active');
        const selectedSessionId = activeSessionTab ? activeSessionTab.dataset.id : '';

        if (window.chrome?.storage?.local) {
            chrome.storage.local.set({
                websocketKongSessions: data,
                websocketKongSelectedSession: selectedSessionId
            });
        } else {
            localStorage.setItem('websocketKongSessions', JSON.stringify(data));
            localStorage.setItem('websocketKongSelectedSession', selectedSessionId);
        }
    }

    async function restoreSessions() {
        return new Promise((resolve) => {
            if (window.chrome?.storage?.local) {
                chrome.storage.local.get(['websocketKongSessions', 'websocketKongSelectedSession'], (result) => {
                    const arr = result.websocketKongSessions || [];
                    let idList = [];
                    arr.forEach(sessionData => {
                        const id = addSession(sessionData);
                        idList.push(sessionData.id ?? id);
                    });
                    sessionCounter = arr.length;
                    const selectedId = result.websocketKongSelectedSession;
                    if (selectedId && sessions[selectedId]) {
                        selectSession(selectedId);
                    } else if (idList.length > 0 && sessions[idList[0]]) {
                        selectSession(idList[0]);
                    }
                    resolve();
                });
            } else {
                const arr = JSON.parse(localStorage.getItem('websocketKongSessions') || '[]');
                let idList = [];
                arr.forEach(sessionData => {
                    const id = addSession(sessionData);
                    idList.push(sessionData.id ?? id);
                });
                sessionCounter = arr.length;
                const selectedId = localStorage.getItem('websocketKongSelectedSession');

                if (selectedId && sessions[selectedId]) {
                    selectSession(selectedId);
                } else if (idList.length > 0 && sessions[idList[0]]) {
                    selectSession(idList[0]);
                }
                resolve();
            }
        });
    }

    function updateEmptyTitle() {
        const emptyTitle = document.getElementById('empty-title');
        const topAddSessionBtn = document.getElementById('add-session');
        if (!emptyTitle) return;
        if (Object.keys(sessions).length === 0) {
            emptyTitle.style.display = 'block';
            if (topAddSessionBtn) topAddSessionBtn.style.display = 'none';
            // New Session 버튼 이벤트 항상 연결
            const emptyAddSessionBtn = document.getElementById('empty-add-session');
            if (emptyAddSessionBtn && !emptyAddSessionBtn._wsKongBound) {
                emptyAddSessionBtn.addEventListener('click', () => {
                    const newId = addSession();
                    selectSession(newId);
                });
                emptyAddSessionBtn._wsKongBound = true; // 중복 방지
            }
        } else {
            emptyTitle.style.display = 'none';
            if (topAddSessionBtn) topAddSessionBtn.style.display = '';
        }
    }
});