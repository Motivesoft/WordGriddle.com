// Import this script file before any other script that will want database access
// Note: the database is only opened on the DOMContentLoaded event

class DBConnection {
    constructor(dbName, storeNames, version = 1) {
        this.dbName = dbName;
        this.storeNames = storeNames; // Array of object store names
        this.version = version;
        this.db = null;
    }

    // Open the database connection
    open() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db); // Return existing connection if already open
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.storeNames.forEach((storeName) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });
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
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    // Add an object to a specific store
    add(storeName, object) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(object);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Put an object to a specific store
    put(storeName, object) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(object);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Get an object by ID from a specific store
    get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Update an object in a specific store
    update(storeName, object) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(object);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Delete an object by ID from a specific store
    delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Get all objects from a specific store
    getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Get all objects from a specific store within a specific range
    getInRange(storeName, lowerBound, upperBound) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const range = IDBKeyRange.bound(lowerBound, upperBound);
            const request = store.getAll(range);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Perform a transaction across multiple stores
    transaction(storeNames, mode = 'readonly', callback) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeNames, mode);
            const stores = storeNames.reduce((acc, storeName) => {
                acc[storeName] = transaction.objectStore(storeName);
                return acc;
            }, {});

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);

            callback(stores, transaction);
        });
    }
}

// Define the database and object stores
const dbName = 'Test';

const ObjectStores = Object.freeze({
    PUZZLE_STATUS: "PuzzleStatus",
    PUZZLE_PROGRESS: "PuzzleProgress",
});

// Specific database functions

function dbGetPuzzleStatusInRange(lowerPuzzleId, upperPuzzleId) {
    console.debug(`Get puzzle status in range (${lowerPuzzleId},${upperPuzzleId})`);

    return dbConnection.getInRange(ObjectStores.PUZZLE_STATUS, lowerPuzzleId, upperPuzzleId);
}

function dbDeletePuzzleStatus(puzzleId) {
    console.debug(`Delete puzzle status for ${puzzleId}`);

    return dbConnection.delete(ObjectStores.PUZZLE_STATUS, puzzleId);
}

function dbStorePuzzleStatus(puzzleId, puzzleStatus) {
    console.debug(`Store puzzle status for ${puzzleId}`);
    // dumpObject(`Store puzzle status`, puzzleId, puzzleStatus);

    return dbConnection.update(ObjectStores.PUZZLE_STATUS, {id: puzzleId, ...puzzleStatus});
}

function dbGetPuzzleProgress(puzzleId) {
    console.debug(`Get puzzle progress for ${puzzleId}`);

    return dbConnection.get(ObjectStores.PUZZLE_PROGRESS, puzzleId);
}

function dbDeletePuzzleProgress(puzzleId) {
    console.debug(`Delete puzzle progress for ${puzzleId}`);

    return dbConnection.delete(ObjectStores.PUZZLE_PROGRESS, puzzleId);
}

function dbStorePuzzleProgress(puzzleId, puzzleProgress) {
    console.debug(`Store puzzle progress for ${puzzleId}`);
    // dumpObject(`Store puzzle progress`, puzzleId, puzzleProgress);

    return dbConnection.put(ObjectStores.PUZZLE_PROGRESS, {id: puzzleId, ...puzzleProgress});
}

function dumpObject(title, id, object) {
    console.debug(`${title} : ${id}`);

    if (object) {
        const keys = Object.keys(object);
        const values = Object.values(object);
        for( let i = 0; i < keys.length; i++) {
            console.debug(`  ${keys[i]} : ${values[i]} (${typeof(values[i])})`);
        }
    }
}

// Create an instance of DBConnection
const dbConnection = new DBConnection(dbName, [ObjectStores.PUZZLE_STATUS, ObjectStores.PUZZLE_PROGRESS]);

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await dbConnection.open();
        console.log('Database connection opened successfully.');
    } catch (error) {
        console.error('Failed to open database:', error);
    }
});

window.addEventListener('unload', () => {
    dbConnection.close();
    console.log('Database connection closed.');
});
