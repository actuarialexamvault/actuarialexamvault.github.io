// Firebase Firestore Data Service
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs,
    query,
    where,
    updateDoc,
    deleteDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class FirestoreDataService {
    constructor() {
        this.usersCollection = 'users';
        this.submissionsCollection = 'examSubmissions';
        this.gradingsCollection = 'questionGradings';
    }

    // ==== USER DATA ====
    
    // Save user profile data
    async saveUserProfile(userId, userData) {
        try {
            const userRef = doc(db, this.usersCollection, userId);
            await setDoc(userRef, {
                ...userData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return { success: true };
        } catch (error) {
            console.error('Error saving user profile:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user profile data
    async getUserProfile(userId) {
        try {
            const userRef = doc(db, this.usersCollection, userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                return { success: true, data: userSnap.data() };
            } else {
                return { success: false, error: 'User profile not found' };
            }
        } catch (error) {
            console.error('Error getting user profile:', error);
            return { success: false, error: error.message };
        }
    }

    // ==== EXAM SUBMISSIONS ====
    
    // Save exam submission
    async saveExamSubmission(userId, submissionId, submissionData) {
        try {
            const submissionRef = doc(db, this.submissionsCollection, `${userId}_${submissionId}`);
            await setDoc(submissionRef, {
                userId: userId,
                submissionId: submissionId,
                ...submissionData,
                createdAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error saving exam submission:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all exam submissions for a user
    async getExamSubmissions(userId) {
        try {
            const q = query(
                collection(db, this.submissionsCollection),
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(q);
            
            const submissions = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                submissions[data.submissionId] = data;
            });
            
            return { success: true, data: submissions };
        } catch (error) {
            console.error('Error getting exam submissions:', error);
            return { success: false, error: error.message };
        }
    }

    // Get specific exam submission
    async getExamSubmission(userId, submissionId) {
        try {
            const submissionRef = doc(db, this.submissionsCollection, `${userId}_${submissionId}`);
            const submissionSnap = await getDoc(submissionRef);
            
            if (submissionSnap.exists()) {
                return { success: true, data: submissionSnap.data() };
            } else {
                return { success: false, error: 'Submission not found' };
            }
        } catch (error) {
            console.error('Error getting exam submission:', error);
            return { success: false, error: error.message };
        }
    }

    // Update exam submission
    async updateExamSubmission(userId, submissionId, updateData) {
        try {
            const submissionRef = doc(db, this.submissionsCollection, `${userId}_${submissionId}`);
            await updateDoc(submissionRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating exam submission:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete exam submission
    async deleteExamSubmission(userId, submissionId) {
        try {
            const submissionRef = doc(db, this.submissionsCollection, `${userId}_${submissionId}`);
            await deleteDoc(submissionRef);
            return { success: true };
        } catch (error) {
            console.error('Error deleting exam submission:', error);
            return { success: false, error: error.message };
        }
    }

    // ==== QUESTION GRADINGS ====
    
    // Save question grading
    async saveQuestionGrading(userId, submissionId, questionNumber, gradingData) {
        try {
            const gradingId = `${userId}_${submissionId}_Q${questionNumber}`;
            const gradingRef = doc(db, this.gradingsCollection, gradingId);
            await setDoc(gradingRef, {
                userId: userId,
                submissionId: submissionId,
                questionNumber: questionNumber,
                ...gradingData,
                createdAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error saving question grading:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all gradings for a submission
    async getSubmissionGradings(userId, submissionId) {
        try {
            const q = query(
                collection(db, this.gradingsCollection),
                where('userId', '==', userId),
                where('submissionId', '==', submissionId)
            );
            const querySnapshot = await getDocs(q);
            
            const gradings = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                gradings[`Q${data.questionNumber}`] = data;
            });
            
            return { success: true, data: gradings };
        } catch (error) {
            console.error('Error getting submission gradings:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all gradings for a user
    async getAllUserGradings(userId) {
        try {
            const q = query(
                collection(db, this.gradingsCollection),
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(q);
            
            const gradings = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const key = `${data.submissionId}_Q${data.questionNumber}`;
                gradings[key] = data;
            });
            
            return { success: true, data: gradings };
        } catch (error) {
            console.error('Error getting user gradings:', error);
            return { success: false, error: error.message };
        }
    }

    // Update question grading
    async updateQuestionGrading(userId, submissionId, questionNumber, updateData) {
        try {
            const gradingId = `${userId}_${submissionId}_Q${questionNumber}`;
            const gradingRef = doc(db, this.gradingsCollection, gradingId);
            await updateDoc(gradingRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating question grading:', error);
            return { success: false, error: error.message };
        }
    }

    // ==== HELPER METHODS ====
    
    // Get user submissions as array
    async getUserSubmissions(userId) {
        try {
            const result = await this.getExamSubmissions(userId);
            if (result.success) {
                // Convert object to array
                return Object.values(result.data);
            }
            return [];
        } catch (error) {
            console.error('Error getting user submissions:', error);
            return [];
        }
    }

    // Get user gradings as array
    async getUserGradings(userId) {
        try {
            const result = await this.getAllUserGradings(userId);
            if (result.success) {
                // Convert object to array
                return Object.values(result.data);
            }
            return [];
        } catch (error) {
            console.error('Error getting user gradings:', error);
            return [];
        }
    }
}

// Create and export a single instance
export const firestoreData = new FirestoreDataService();
