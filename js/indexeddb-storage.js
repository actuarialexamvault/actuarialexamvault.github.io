// IndexedDB Storage Service for storing files locally
class IndexedDBStorageService {
    constructor() {
        this.dbName = 'ActuarialExamVault';
        this.storeName = 'examFiles';
        this.db = null;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                console.error('Error opening IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    objectStore.createIndex('userId', 'userId', { unique: false });
                    objectStore.createIndex('submissionId', 'submissionId', { unique: false });
                    console.log('Object store created');
                }
            };
        });
    }

    // Ensure database is initialized
    async ensureDB() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    }

    // Store a file
    async storeFile(userId, submissionId, file) {
        try {
            await this.ensureDB();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = async (e) => {
                    const fileData = {
                        id: `${userId}_${submissionId}`,
                        userId: userId,
                        submissionId: submissionId,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        data: e.target.result, // ArrayBuffer
                        uploadDate: new Date().toISOString()
                    };

                    const transaction = this.db.transaction([this.storeName], 'readwrite');
                    const objectStore = transaction.objectStore(this.storeName);
                    const request = objectStore.put(fileData);

                    request.onsuccess = () => {
                        console.log('File stored successfully:', file.name);
                        resolve({
                            success: true,
                            fileId: fileData.id,
                            fileName: file.name,
                            fileSize: file.size
                        });
                    };

                    request.onerror = () => {
                        console.error('Error storing file:', request.error);
                        reject(request.error);
                    };
                };

                reader.onerror = () => {
                    console.error('Error reading file:', reader.error);
                    reject(reader.error);
                };

                // Read file as ArrayBuffer
                reader.readAsArrayBuffer(file);
            });
        } catch (error) {
            console.error('Error in storeFile:', error);
            return { success: false, error: error.message };
        }
    }

    // Retrieve a file
    async getFile(userId, submissionId) {
        try {
            await this.ensureDB();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const objectStore = transaction.objectStore(this.storeName);
                const request = objectStore.get(`${userId}_${submissionId}`);

                request.onsuccess = () => {
                    if (request.result) {
                        const fileData = request.result;
                        // Convert ArrayBuffer back to Blob
                        const blob = new Blob([fileData.data], { type: fileData.fileType });
                        resolve({
                            success: true,
                            blob: blob,
                            fileName: fileData.fileName,
                            fileType: fileData.fileType,
                            fileSize: fileData.fileSize,
                            uploadDate: fileData.uploadDate
                        });
                    } else {
                        resolve({ success: false, error: 'File not found' });
                    }
                };

                request.onerror = () => {
                    console.error('Error retrieving file:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error in getFile:', error);
            return { success: false, error: error.message };
        }
    }

    // Download a file
    async downloadFile(userId, submissionId) {
        try {
            const result = await this.getFile(userId, submissionId);
            
            if (result.success) {
                // Create download link
                const url = URL.createObjectURL(result.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                return { success: true, fileName: result.fileName };
            } else {
                return result;
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a file
    async deleteFile(userId, submissionId) {
        try {
            await this.ensureDB();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const objectStore = transaction.objectStore(this.storeName);
                const request = objectStore.delete(`${userId}_${submissionId}`);

                request.onsuccess = () => {
                    console.log('File deleted successfully');
                    resolve({ success: true });
                };

                request.onerror = () => {
                    console.error('Error deleting file:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error in deleteFile:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all files for a user
    async getUserFiles(userId) {
        try {
            await this.ensureDB();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const objectStore = transaction.objectStore(this.storeName);
                const index = objectStore.index('userId');
                const request = index.getAll(userId);

                request.onsuccess = () => {
                    const files = request.result.map(file => ({
                        submissionId: file.submissionId,
                        fileName: file.fileName,
                        fileSize: file.fileSize,
                        uploadDate: file.uploadDate
                    }));
                    resolve({ success: true, files: files });
                };

                request.onerror = () => {
                    console.error('Error getting user files:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error in getUserFiles:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if file exists
    async fileExists(userId, submissionId) {
        try {
            await this.ensureDB();

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const objectStore = transaction.objectStore(this.storeName);
                const request = objectStore.get(`${userId}_${submissionId}`);

                request.onsuccess = () => {
                    resolve({ success: true, exists: !!request.result });
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create and export a single instance
export const indexedDBStorage = new IndexedDBStorageService();
