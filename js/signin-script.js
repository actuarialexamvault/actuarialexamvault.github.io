// Sign in form functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';

const signinForm = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signinButton = document.querySelector('.btn-signin');
const googleSigninBtn = document.getElementById('googleSigninBtn');
const togglePasswordButton = document.getElementById('togglePassword');

// Check if user is already logged in
if (firebaseAuth.isAuthenticated()) {
    window.location.href = 'dashboard.html'; // Already in pages folder
}

// Enable/disable sign in button based on form validity
function validateForm() {
    const emailValid = emailInput.value.trim() !== '' && emailInput.validity.valid;
    const passwordValid = passwordInput.value.trim() !== '';
    
    if (emailValid && passwordValid) {
        signinButton.disabled = false;
    } else {
        signinButton.disabled = true;
    }
}

// Listen for input changes
emailInput.addEventListener('input', validateForm);
passwordInput.addEventListener('input', validateForm);

// Toggle password visibility
togglePasswordButton.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    const icon = togglePasswordButton.querySelector('svg');
    if (type === 'text') {
        icon.style.opacity = '0.5';
    } else {
        icon.style.opacity = '1';
    }
});

// Handle form submission
signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Show loading state
    const originalButtonContent = signinButton.innerHTML;
    signinButton.innerHTML = '<span>Signing in...</span>';
    signinButton.disabled = true;
    
    // Sign in with Firebase
    const result = await firebaseAuth.signin(email, password);
    
    if (result.success) {
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } else {
        // Show error modal
        showErrorModal(result.error);
        signinButton.innerHTML = originalButtonContent;
        validateForm();
    }
});

// Handle forgot password link
document.querySelector('.forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    showErrorModal('Password reset functionality: In a production app, this would send a password reset email.');
});

// Error Modal Functions
function showErrorModal(message) {
    const modal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    modal.style.display = 'flex';
    
    // Handle close button
    document.getElementById('closeError').onclick = () => {
        modal.style.display = 'none';
    };
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Google Sign In Handler
googleSigninBtn.addEventListener('click', async () => {
    // Show loading state
    const originalButtonContent = googleSigninBtn.innerHTML;
    googleSigninBtn.innerHTML = '<span>Signing in with Google...</span>';
    googleSigninBtn.disabled = true;

    try {
        const result = await firebaseAuth.signInWithGoogle();

        if (result.success) {
            // Split displayName into name and surname
            const displayName = result.user.displayName || 'User';
            const nameParts = displayName.trim().split(' ');
            const name = nameParts[0] || displayName;
            const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            // Update user profile with last login
            await firestoreData.saveUserProfile(result.user.uid, {
                name: name,
                surname: surname,
                fullname: displayName,
                email: result.user.email,
                photoURL: result.user.photoURL || null,
                lastLogin: new Date().toISOString()
            });

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error
            showErrorModal(result.error);
            googleSigninBtn.innerHTML = originalButtonContent;
            googleSigninBtn.disabled = false;
        }
    } catch (error) {
        console.error('Google signin error:', error);
        showErrorModal('An error occurred during Google sign in. Please try again.');
        googleSigninBtn.innerHTML = originalButtonContent;
        googleSigninBtn.disabled = false;
    }
});
