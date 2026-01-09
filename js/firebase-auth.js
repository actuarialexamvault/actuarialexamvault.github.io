// Firebase Authentication Service
import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class FirebaseAuthService {
    constructor() {
        this.currentUser = null;
        this.googleProvider = new GoogleAuthProvider();
        this.authReady = false;
        this.authReadyPromise = new Promise((resolve) => {
            this.authReadyResolver = resolve;
        });
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            console.log('Auth state changed:', user ? user.email : 'No user');
            if (!this.authReady) {
                this.authReady = true;
                this.authReadyResolver();
            }
        });
    }

    // Wait for auth state to be initialized
    async waitForAuthReady() {
        return this.authReadyPromise;
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

    // Sign in/up with Google
    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, this.googleProvider);
            console.log('User signed in with Google:', result.user.email);
            return {
                success: true,
                user: result.user,
                isNewUser: result._tokenResponse?.isNewUser || false
            };
        } catch (error) {
            console.error('Google signin error:', error);
            
            // Handle account-exists-with-different-credential error
            if (error.code === 'auth/account-exists-with-different-credential') {
                return {
                    success: false,
                    error: 'This email is already registered with an existing account. Please sign in using your email and password.'
                };
            }
            
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

    // Send password reset email
    async sendPasswordResetEmail(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            console.log('Password reset email sent to:', email);
            return {
                success: true
            };
        } catch (error) {
            console.error('Password reset error:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // Convert Firebase error codes to user-friendly messages
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/operation-not-allowed': 'Google Sign-In is not enabled. Please enable it in Firebase Console: Authentication → Sign-in method → Google',
            'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
            'auth/cancelled-popup-request': 'Sign-in was cancelled.',
            'auth/account-exists-with-different-credential': 'An account with this email already exists with a different sign-in method. Please use your original sign-in method.',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later',
            'auth/unauthorized-domain': 'This domain is not authorized. Add it to Firebase Console: Authentication → Settings → Authorized domains',
            'auth/user-not-found': 'No account found with this email',
            'auth/missing-email': 'Please enter an email address'
        };
        
        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    }
}

// Create and export a single instance
export const firebaseAuth = new FirebaseAuthService();
