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

const tabInbox = document.getElementById('tab-inbox');
const tabBrain = document.getElementById('tab-brain');
const tabArchive = document.getElementById('tab-archive');
const noteEditor = document.getElementById('note-editor');
const sidebar = document.getElementById('sidebar');
const categoryTree = document.getElementById('category-tree');
const breadcrumb = document.getElementById('breadcrumb');

let editingId = null;
let currentMode = 'inbox'; // 'inbox', 'brain', or 'archive'
let selectedCategory = null;

const BASE_CATEGORIES = ['Todo', 'ウィッシュリスト', 'ナレッジ', '日記', 'マインドセット'];

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

    // Tabs
    tabInbox.addEventListener('click', () => switchMode('inbox'));
    tabBrain.addEventListener('click', () => switchMode('brain'));
    tabArchive.addEventListener('click', () => switchMode('archive'));

    // Category filtering
    categoryTree.addEventListener('click', (e) => {
        const item = e.target.closest('.category-item');
        if (item) {
            const category = item.dataset.category === 'all' ? null : item.dataset.category;
            selectCategory(category);
        }
    });

    // Then load data
    await renderNotes();
}

async function switchMode(mode) {
    currentMode = mode;
    selectedCategory = null;
    tabInbox.classList.toggle('active', mode === 'inbox');
    tabBrain.classList.toggle('active', mode === 'brain');
    tabArchive.classList.toggle('active', mode === 'archive');
    
    // UI layout: Editor only in inbox, Sidebar and Breadcrumb only in brain
    noteEditor.style.display = mode === 'inbox' ? 'block' : 'none';
    sidebar.style.display = (mode === 'brain' || mode === 'archive') ? 'block' : 'none';
    breadcrumb.style.display = mode === 'brain' ? 'block' : 'none';
    
    if (mode === 'brain' || mode === 'archive') {
        await renderCategoryTree();
    }
    
    await renderNotes();
}

async function renderCategoryTree() {
    const notes = await storage.getNotes(currentMode);
    const categories = new Set(BASE_CATEGORIES);
    
    notes.forEach(note => {
        if (note.category) {
            const parts = note.category.split('/');
            let path = '';
            parts.forEach((part, index) => {
                path += (index === 0 ? '' : '/') + part;
                categories.add(path);
            });
        }
    });

    const sortedCategories = Array.from(categories).sort((a, b) => {
        // Keep base categories at top if possible, or just sort normally
        return a.localeCompare(b);
    });
    
    categoryTree.innerHTML = `
        <li class="category-item ${!selectedCategory ? 'active' : ''}" data-category="all">📁 全て</li>
        ${sortedCategories.map(cat => {
            const depth = (cat.match(/\//g) || []).length;
            const label = cat.split('/').pop();
            return `<li class="category-item ${depth > 0 ? 'child' : ''} ${selectedCategory === cat ? 'active' : ''}" 
                data-category="${cat}" 
                style="padding-left: ${depth * 1 + 0.6}rem">
                ${depth > 0 ? '└ ' : ''}${label}
            </li>`;
        }).join('')}
    `;
    updateBreadcrumb();
}

function updateBreadcrumb() {
    if (currentMode !== 'brain') {
        breadcrumb.innerHTML = '';
        return;
    }
    if (!selectedCategory) {
        breadcrumb.innerHTML = '<span>ROOT</span>';
        return;
    }
    const parts = selectedCategory.split('/');
    breadcrumb.innerHTML = parts.map((part, i) => {
        const path = parts.slice(0, i + 1).join('/');
        return `<span class="breadcrumb-item" onclick="selectCategory('${path}')">${part}</span>`;
    }).join(' > ');
    
    // Make breadcrumb items clickable (global scope hack or proper event listener)
    window.selectCategory = selectCategory; 
}

function selectCategory(category) {
    selectedCategory = category;
    renderCategoryTree();
    renderNotes();
}

function openSettings() {
    const config = storage.getConfig() || { token: '', repo: '', path: 'inbox.json' };
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
    alert('設定を保存しました。');
    await renderNotes();
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
            created_at: new Date().toISOString(),
            source: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'pc'
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
    const notes = await storage.getNotes(currentMode);
    
    const filteredNotes = notes.filter(note => {
        const textMatch = note.text.toLowerCase().includes(query);
        const tags = note.tags || [];
        const tagMatch = tags.some(tag => tag.toLowerCase().includes(query.replace('#', '')));
        const categoryMatch = (note.category || '').toLowerCase().includes(query);
        const summaryMatch = (note.summary || '').toLowerCase().includes(query);
        
        // Category tree filter
        let treeMatch = true;
        if ((currentMode === 'brain' || currentMode === 'archive') && selectedCategory) {
            treeMatch = note.category === selectedCategory || (note.category || '').startsWith(selectedCategory + '/');
        }

        return (textMatch || tagMatch || categoryMatch || summaryMatch) && treeMatch;
    });

    noteList.innerHTML = '';
    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = `note-card ${currentMode}-card markdown-body`;
        
        const date = new Date(note.created_at).toLocaleString();
        const tags = note.tags || [];
        
        const showText = currentMode !== 'brain';
        const showSummary = !!note.summary;

        // Render Markdown
        const renderedText = showText ? marked.parse(note.text) : '';
        const renderedSummary = showSummary ? marked.parse(note.summary) : '';

        card.innerHTML = `
            <div class="note-date">${date} ${note.category ? `| 📁 ${note.category}` : ''}</div>
            ${showText ? `<div class="note-text">${renderedText}</div>` : ''}
            ${showSummary ? `<div class="note-summary">${renderedSummary}</div>` : ''}
            <div class="note-tags">
                ${tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="note-actions">
                ${currentMode === 'inbox' ? `
                    <button class="edit-btn secondary" data-id="${note.id}">編集</button>
                    <button class="delete-btn danger" data-id="${note.id}">削除</button>
                ` : ''}
            </div>
        `;
        
        if (currentMode === 'inbox') {
            card.querySelector('.edit-btn').addEventListener('click', () => editNote(note));
            card.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));
        }
        
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
