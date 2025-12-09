// Firebase Storage Service for PDF files
import { storage } from './firebase-config.js';
import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    listAll 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

class FirebaseStorageService {
    constructor() {
        this.pdfFolder = 'exam-pdfs';
    }

    // Upload PDF file
    async uploadPDF(userId, submissionId, file) {
        try {
            // Create a reference to the file location
            const fileName = `${submissionId}_${file.name}`;
            const fileRef = ref(storage, `${this.pdfFolder}/${userId}/${fileName}`);
            
            // Upload the file
            console.log('Uploading PDF:', fileName);
            const snapshot = await uploadBytes(fileRef, file);
            
            // Get the download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            console.log('PDF uploaded successfully:', downloadURL);
            return { 
                success: true, 
                url: downloadURL,
                fileName: fileName,
                fullPath: snapshot.ref.fullPath
            };
        } catch (error) {
            console.error('Error uploading PDF:', error);
            return { success: false, error: error.message };
        }
    }

    // Get PDF download URL
    async getPDFUrl(userId, fileName) {
        try {
            const fileRef = ref(storage, `${this.pdfFolder}/${userId}/${fileName}`);
            const downloadURL = await getDownloadURL(fileRef);
            return { success: true, url: downloadURL };
        } catch (error) {
            console.error('Error getting PDF URL:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete PDF file
    async deletePDF(userId, fileName) {
        try {
            const fileRef = ref(storage, `${this.pdfFolder}/${userId}/${fileName}`);
            await deleteObject(fileRef);
            console.log('PDF deleted successfully:', fileName);
            return { success: true };
        } catch (error) {
            console.error('Error deleting PDF:', error);
            return { success: false, error: error.message };
        }
    }

    // List all PDFs for a user
    async listUserPDFs(userId) {
        try {
            const folderRef = ref(storage, `${this.pdfFolder}/${userId}`);
            const result = await listAll(folderRef);
            
            const files = [];
            for (const itemRef of result.items) {
                const url = await getDownloadURL(itemRef);
                files.push({
                    name: itemRef.name,
                    fullPath: itemRef.fullPath,
                    url: url
                });
            }
            
            return { success: true, files: files };
        } catch (error) {
            console.error('Error listing PDFs:', error);
            return { success: false, error: error.message };
        }
    }

    // Download PDF (opens in new tab)
    async downloadPDF(userId, fileName) {
        try {
            const result = await this.getPDFUrl(userId, fileName);
            if (result.success) {
                window.open(result.url, '_blank');
                return { success: true };
            } else {
                return result;
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create and export a single instance
export const firebaseStorage = new FirebaseStorageService();
