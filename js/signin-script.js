// Sign in form functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';

const signinForm = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signinButton = document.querySelector('.btn-signin');
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
