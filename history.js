const STORAGE_KEY = 'ws-history';

export function saveMessage(sessionId, msg) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[sessionId] = all[sessionId] || [];
    all[sessionId].push(msg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function loadHistory(sessionId) {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all[sessionId] || [];
}