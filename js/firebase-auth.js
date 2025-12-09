// Firebase Authentication Service
import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class FirebaseAuthService {
    constructor() {
        this.currentUser = null;
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            console.log('Auth state changed:', user ? user.email : 'No user');
        });
    }

    // Sign up new user
    async signup(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('User signed up:', userCredential.user.email);
            return {
                success: true,
                user: userCredential.user
            };
        } catch (error) {
            console.error('Signup error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // Sign in existing user
    async signin(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('User signed in:', userCredential.user.email);
            return {
                success: true,
                user: userCredential.user
            };
        } catch (error) {
            console.error('Signin error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // Sign out user
    async signout() {
        try {
            await signOut(auth);
            console.log('User signed out');
            return { success: true };
        } catch (error) {
            console.error('Signout error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get current user
    getCurrentUser() {
        return auth.currentUser;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return auth.currentUser !== null;
    }

    // Get user email
    getUserEmail() {
        return auth.currentUser ? auth.currentUser.email : null;
    }

    // Get user ID
    getUserId() {
        return auth.currentUser ? auth.currentUser.uid : null;
    }

    // Convert Firebase error codes to user-friendly messages
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later'
        };
        
        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    }
}

// Create and export a single instance
export const firebaseAuth = new FirebaseAuthService();
