class DBConnection {
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    // Open the database connection
    open() {
        console.debug( "Opening database");
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db); // Return existing connection if already open
                return;
            }

            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                console.debug("Creating database");
                const db = event.target.result;
                // if (!db.objectStoreNames.contains(this.storeName)) {
                //     db.createObjectStore(this.storeName, { keyPath: 'id' });
                // }
                if (!db.objectStoreNames.contains('PuzzleProgress')) {
                    db.createObjectStore('PuzzleProgress', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('PuzzleStatus')) {
                    db.createObjectStore('PuzzleStatus', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // Close the database connection
    close() {
        console.debug( "Closing database");
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // Get the current database connection
    getDB() {
        if (!this.db) {
            throw new Error('Database connection is not open.');
        }
        return this.db;
    }

    async putObject(id, jsonObject) {
        console.debug( "Put object");
        const db = this.getDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put({ id, ...jsonObject });
    
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    async deleteObject(id) {
        console.debug( "Delete object");
        const db = this.getDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    async getObject(id) {
        console.debug( "Get object");
        const db = this.getDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);
    
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    async getObjectsInRange(lowerBound, upperBound) {
        console.debug( "Get objects");
        const db = this.getDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const range = IDBKeyRange.bound(lowerBound, upperBound);
        const request = store.getAll(range);
    
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
    
    async getAllObjects() {
        console.debug( "Get all objects");
        const db = this.getDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
    
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}


// Singleton instance(s)
const dbPuzzleProgressConnection = new DBConnection('Test', 'PuzzleProgress');
const dbPuzzleStatusConnection = new DBConnection('Test', 'PuzzleStatus');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // indexedDB.deleteDatabase('Test');

        await dbPuzzleProgressConnection.open();
        await dbPuzzleStatusConnection.open();
        console.log('Database connection opened successfully.');
    } catch (error) {
        console.error('Failed to open database:', error);
    }
});

window.addEventListener('unload', () => {
    dbPuzzleProgressConnection.close();
    dbPuzzleStatusConnection.close();
    console.log('Database connection closed.');
});

