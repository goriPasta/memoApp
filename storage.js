/**
 * Storage Layer for Memo System
 * Supports localStorage and GitHub API.
 */

class Storage {
    constructor() {
        this.STORAGE_KEY = 'memo_system_notes';
        this.CONFIG_KEY = 'memo_system_gh_config';
        this.ghSha = null; // Cache SHA for GitHub updates
    }

    getConfig() {
        const config = localStorage.getItem(this.CONFIG_KEY);
        return config ? JSON.parse(config) : null;
    }

    saveConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    }

    async getNotes(mode = 'inbox') {
        const config = this.getConfig();
        const fileName = mode === 'inbox' ? 'inbox.json' : 'brain.json';
        
        if (config && config.token && config.repo) {
            return await this.getNotesFromGitHub(config, fileName);
        } else {
            return await this.getNotesFromLocal(fileName);
        }
    }

    async saveNotes(notes, mode = 'inbox') {
        const config = this.getConfig();
        const fileName = mode === 'inbox' ? 'inbox.json' : 'brain.json';

        if (config && config.token && config.repo) {
            await this.saveNotesToGitHub(config, fileName, notes);
        } else {
            localStorage.setItem(`${this.STORAGE_KEY}_${fileName}`, JSON.stringify(notes));
        }
    }

    // Local Logic
    async getNotesFromLocal(fileName) {
        let notes = localStorage.getItem(`${this.STORAGE_KEY}_${fileName}`);
        return notes ? JSON.parse(notes) : [];
    }

    // GitHub Logic
    async getNotesFromGitHub(config, fileName) {
        const url = `https://api.github.com/repos/${config.repo}/contents/${fileName}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                return [];
            }

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }

            const data = await response.json();
            this.ghSha = data.sha;
            const content = atob(data.content.replace(/\n/g, ''));
            return JSON.parse(decodeURIComponent(escape(content)));
        } catch (e) {
            console.error('GitHub fetch failed', e);
            return await this.getNotesFromLocal(fileName);
        }
    }

    async saveNotesToGitHub(config, fileName, notes) {
        const url = `https://api.github.com/repos/${config.repo}/contents/${fileName}`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(notes, null, 2))));
        
        // Before saving, we need the latest SHA
        try {
            const res = await fetch(url, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                this.ghSha = data.sha;
            }
        } catch (e) { /* ignore 404 */ }

        const body = {
            message: `Update ${fileName}: ${new Date().toISOString()}`,
            content: content,
            sha: this.ghSha
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GitHub Save Failed: ${error.message}`);
        }

        const data = await response.json();
        this.ghSha = data.content.sha;
        
        localStorage.setItem(`${this.STORAGE_KEY}_${fileName}`, JSON.stringify(notes));
    }

    // Convenience methods
    async addNote(note) {
        const notes = await this.getNotes();
        notes.unshift(note);
        await this.saveNotes(notes);
    }

    async updateNote(id, updatedNote) {
        let notes = await this.getNotes();
        notes = notes.map(n => n.id === id ? { ...n, ...updatedNote } : n);
        await this.saveNotes(notes);
    }

    async deleteNote(id) {
        let notes = await this.getNotes();
        notes = notes.filter(n => n.id !== id);
        await this.saveNotes(notes);
    }
}

export const storage = new Storage();
