import { storage } from './storage.js';

const noteTextarea = document.getElementById('note-textarea');
const tagInput = document.getElementById('tag-input');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const noteList = document.getElementById('note-list');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const ghTokenInput = document.getElementById('gh-token');
const ghRepoInput = document.getElementById('gh-repo');
const ghPathInput = document.getElementById('gh-path');

let editingId = null;

// Initialize app
async function init() {
    initTheme();

    // Attach event listeners first
    saveBtn.addEventListener('click', saveNote);
    cancelBtn.addEventListener('click', resetEditor);
    searchInput.addEventListener('input', renderNotes);
    themeToggle.addEventListener('click', toggleTheme);

    // Settings
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    saveSettingsBtn.addEventListener('click', saveSettings);

    // Then load data
    try {
        await renderNotes();
    } catch (e) {
        console.error('Failed to load notes', e);
    }
}

function openSettings() {
    const config = storage.getConfig() || { token: '', repo: '', path: 'data/notes.json' };
    ghTokenInput.value = config.token;
    ghRepoInput.value = config.repo;
    ghPathInput.value = config.path;
    settingsModal.style.display = 'flex';
}

async function saveSettings() {
    const config = {
        token: ghTokenInput.value.trim(),
        repo: ghRepoInput.value.trim(),
        path: ghPathInput.value.trim()
    };
    storage.saveConfig(config);
    settingsModal.style.display = 'none';
    alert('設定を保存しました。再読み込みして同期を開始します。');
    location.reload();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

async function saveNote() {
    const text = noteTextarea.value.trim();
    if (!text) return;

    const tags = tagInput.value.split(',')
        .map(t => t.trim())
        .filter(t => t !== '');

    if (editingId) {
        await storage.updateNote(editingId, {
            text,
            tags,
            updated_at: new Date().toISOString()
        });
    } else {
        const newNote = {
            id: crypto.randomUUID(),
            text,
            tags,
            created_at: new Date().toISOString()
        };
        await storage.addNote(newNote);
    }

    resetEditor();
    await renderNotes();
}

function resetEditor() {
    editingId = null;
    noteTextarea.value = '';
    tagInput.value = '';
    saveBtn.textContent = '保存';
    cancelBtn.style.display = 'none';
}

async function renderNotes() {
    const query = searchInput.value.toLowerCase();
    const notes = await storage.getNotes();
    
    const filteredNotes = notes.filter(note => {
        const textMatch = note.text.toLowerCase().includes(query);
        const tagMatch = note.tags.some(tag => tag.toLowerCase().includes(query.replace('#', '')));
        return textMatch || tagMatch;
    });

    noteList.innerHTML = '';
    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        
        const date = new Date(note.created_at).toLocaleString();
        
        card.innerHTML = `
            <div class="note-date">${date}</div>
            <div class="note-text">${escapeHtml(note.text)}</div>
            <div class="note-tags">
                ${note.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="note-actions">
                <button class="edit-btn secondary" data-id="${note.id}">編集</button>
                <button class="delete-btn danger" data-id="${note.id}">削除</button>
            </div>
        `;
        
        card.querySelector('.edit-btn').addEventListener('click', () => editNote(note));
        card.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));
        
        noteList.appendChild(card);
    });
}

function editNote(note) {
    editingId = note.id;
    noteTextarea.value = note.text;
    tagInput.value = note.tags.join(', ');
    saveBtn.textContent = '更新';
    cancelBtn.style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    noteTextarea.focus();
}

async function deleteNote(id) {
    if (confirm('このメモを削除しますか？')) {
        await storage.deleteNote(id);
        await renderNotes();
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

init();
