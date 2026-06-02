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

    async getNotes() {
        const config = this.getConfig();
        if (config && config.token && config.repo && config.path) {
            return await this.getNotesFromGitHub(config);
        } else {
            return await this.getNotesFromLocal();
        }
    }

    async saveNotes(notes) {
        const config = this.getConfig();
        if (config && config.token && config.repo && config.path) {
            await this.saveNotesToGitHub(config, notes);
        } else {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
        }
    }

    // Local Logic
    async getNotesFromLocal() {
        let notes = localStorage.getItem(this.STORAGE_KEY);
        if (!notes) {
            try {
                const response = await fetch('./data/notes.json');
                const initialData = await response.json();
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
                return initialData;
            } catch (e) {
                console.error('Local fetch failed', e);
                return [];
            }
        }
        try {
            return JSON.parse(notes);
        } catch (e) {
            console.error('Local JSON parse failed', e);
            return [];
        }
    }

    // GitHub Logic
    async getNotesFromGitHub(config) {
        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                return await this.getNotesFromLocal();
            }

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }

            const data = await response.json();
            this.ghSha = data.sha;
            const content = atob(data.content.replace(/\n/g, ''));
            return JSON.parse(decodeURIComponent(escape(content)));
        } catch (e) {
            console.error('GitHub fetch failed, falling back to local', e);
            return await this.getNotesFromLocal();
        }
    }

    async saveNotesToGitHub(config, notes) {
        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(notes, null, 2))));
        
        const body = {
            message: `Update notes: ${new Date().toISOString()}`,
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
        
        // Also sync to local for offline/backup
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
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
