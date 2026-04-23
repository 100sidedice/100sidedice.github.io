/*
  Saver.js
  - Provides a Saver class that persists JSON save objects using IndexedDB.
  - Usage:
      const saver = new Saver({dbName: '100sidedice', saveId: 'default'});
      await saver.ready; // resolves once initial data is loaded
      saver.getData('player/stats/health');
      saver.setData('player/stats/health', 10);
      await saver.save();

  Notes: avoids localStorage in favor of IndexedDB for reliability and size.
*/

import Signal from './Signal.js';

class Saver {
    constructor({dbName = '100sidedice_saves', storeName = 'saves', saveId = 'default'} = {}) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.saveId = saveId;
        this.data = {};
        this._db = null;
        // Signal that emits (path, value) when a value changes via setData
        this.onChange = new Signal();
        this.ready = this._init();
    }

    async _init() {
        this._db = await this._openDB();
        const saved = await this._get(this.saveId);
        if (saved && typeof saved === 'object') {
            this.data = saved;
        } else {
            this.data = {};
            await this._put(this.saveId, this.data);
        }
        return this;
    }

    _openDB() {
        return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        });
    }

    _transaction(mode = 'readonly') {
        return this._db.transaction([this.storeName], mode).objectStore(this.storeName);
    }

    _get(key) {
        return new Promise((resolve, reject) => {
        try {
            const store = this._transaction('readonly');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (err) {
            reject(err);
        }
        });
    }

    _put(key, value) {
        return new Promise((resolve, reject) => {
        try {
            const store = this._transaction('readwrite');
            const req = store.put(value, key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (err) {
            reject(err);
        }
        });
    }

    _delete(key) {
        return new Promise((resolve, reject) => {
        try {
            const store = this._transaction('readwrite');
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        } catch (err) {
            reject(err);
        }
        });
    }

    // Return an array of save keys
    async getSaveList() {
        return new Promise((resolve, reject) => {
        try {
            const store = this._transaction('readonly');
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (err) {
            reject(err);
        }
        });
    }

    // Load a different save by id (replaces this.data and this.saveId)
    async load(saveId) {
        await this.ready;
        const saved = await this._get(saveId);
        this.saveId = saveId;
        this.data = saved && typeof saved === 'object' ? saved : {};
        return this.data;
    }

    // Delete a save by id
    async delete(saveId) {
        await this.ready;
        return this._delete(saveId);
    }

    // Save current in-memory data to storage
    async save() {
        await this.ready;
        return this._put(this.saveId, this.data);
    }

    // Get data by a path string. Accepts '/' or '.' as separator.
    getData(path, fallback = undefined) {
        if (!path || path === '/') return this.data;
        const segments = path.split(/[/.]+/).filter(Boolean);
        let cursor = this.data;
        for (const segment of segments) {
        if (cursor && typeof cursor === 'object' && segment in cursor) {
            cursor = cursor[segment];
        } else {
            return fallback;
        }
        }
        return cursor;
    }

    // Set data at path, creating nested objects as needed
    setData(path, value) {

        if (!path || path === '/') {
        if (typeof value === 'object') this.data = value; else throw new Error('Root value must be an object');
        try { this.onChange.emit('/', this.data); } catch (e) {}
        return this.data;
        }
        const segments = path.split(/[/.]+/).filter(Boolean);
        let cursor = this.data;
        for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (i === segments.length - 1) {
            cursor[segment] = value;
        } else {
            if (!(segment in cursor) || typeof cursor[segment] !== 'object') {
            cursor[segment] = {};
            }
            cursor = cursor[segment];
        }
        }
        try { this.onChange.emit(path, value); } catch (e) {}
        return value;
    }

    // Convenience: get a shallow clone of the whole save data
    getAll() {
        return JSON.parse(JSON.stringify(this.data));
    }

    logData(){
        console.log('Current save data:', JSON.stringify(this.data, null, 2));
    }
}

export default Saver;
