// Sign up form functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';

const signupForm = document.getElementById('signupForm');
const nameInput = document.getElementById('name');
const surnameInput = document.getElementById('surname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const signupButton = document.querySelector('.btn-signin');
const googleSignupBtn = document.getElementById('googleSignupBtn');
const togglePasswordButton = document.getElementById('togglePassword');
const toggleConfirmPasswordButton = document.getElementById('toggleConfirmPassword');

// Error message elements
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');

// Check if user is already logged in
if (firebaseAuth.isAuthenticated()) {
    window.location.href = 'dashboard.html';
}

// Form validation
function validateForm() {
    let isValid = true;

    // Clear previous errors
    emailError.textContent = '';
    passwordError.textContent = '';
    confirmPasswordError.textContent = '';

    // Check all fields are filled
    const nameValid = nameInput.value.trim() !== '';
    const surnameValid = surnameInput.value.trim() !== '';
    const emailValid = emailInput.value.trim() !== '' && emailInput.validity.valid;
    const passwordValid = passwordInput.value.trim() !== '';
    const confirmPasswordValid = confirmPasswordInput.value.trim() !== '';

    // Validate password length
    if (passwordValid && passwordInput.value.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        isValid = false;
    }

    // Validate password match
    if (passwordValid && confirmPasswordValid && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordError.textContent = 'Passwords do not match';
        isValid = false;
    }

    // Enable/disable button
    if (nameValid && surnameValid && emailValid && passwordValid && confirmPasswordValid && isValid) {
        signupButton.disabled = false;
    } else {
        signupButton.disabled = true;
    }

    return isValid;
}

// Listen for input changes
nameInput.addEventListener('input', validateForm);
surnameInput.addEventListener('input', validateForm);
emailInput.addEventListener('input', validateForm);
passwordInput.addEventListener('input', validateForm);
confirmPasswordInput.addEventListener('input', validateForm);

// Toggle password visibility
function togglePasswordVisibility(input, button) {
    button.addEventListener('click', () => {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const icon = button.querySelector('svg');
        if (type === 'text') {
            icon.style.opacity = '0.5';
        } else {
            icon.style.opacity = '1';
        }
    });
}

togglePasswordVisibility(passwordInput, togglePasswordButton);
togglePasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton);

// Handle form submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const name = nameInput.value.trim();
    const surname = surnameInput.value.trim();
    const fullname = `${name} ${surname}`;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const primaryExam = document.getElementById('primaryExam')?.value || '';

    // Show loading state
    const originalButtonContent = signupButton.innerHTML;
    signupButton.innerHTML = '<span>Creating account...</span>';
    signupButton.disabled = true;

    // Create Firebase account
    const result = await firebaseAuth.signup(email, password);

    if (result.success) {
        // Save user profile to Firestore
        const userProfile = {
            name: name,
            surname: surname,
            fullname: fullname,
            email: email,
            createdAt: new Date().toISOString()
        };
        
        // Add primaryExam if selected
        if (primaryExam) {
            userProfile.primaryExam = primaryExam;
        }
        
        await firestoreData.saveUserProfile(result.user.uid, userProfile);

        // Show success modal
        showSuccessModal();
    } else {
        // Show error message
        emailError.textContent = result.error;
        signupButton.innerHTML = originalButtonContent;
        signupButton.disabled = false;
    }
});

// Success Modal Functions
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'flex';
    
    // Handle Go to Sign In button
    document.getElementById('goToSignin').addEventListener('click', () => {
        window.location.href = 'signin.html';
    });
}

// Google Sign Up Handler
googleSignupBtn.addEventListener('click', async () => {
    // Show loading state
    const originalButtonContent = googleSignupBtn.innerHTML;
    googleSignupBtn.innerHTML = '<span>Signing up with Google...</span>';
    googleSignupBtn.disabled = true;

    try {
        const result = await firebaseAuth.signInWithGoogle();

        if (result.success) {
            // Split displayName into name and surname
            const displayName = result.user.displayName || 'User';
            const nameParts = displayName.trim().split(' ');
            const name = nameParts[0] || displayName;
            const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            // Save/update user profile to Firestore
            const userProfile = {
                name: name,
                surname: surname,
                fullname: displayName,
                email: result.user.email,
                photoURL: result.user.photoURL || null,
                lastLogin: new Date().toISOString()
            };

            // Add createdAt only for new users
            if (result.isNewUser) {
                userProfile.createdAt = new Date().toISOString();
            }

            await firestoreData.saveUserProfile(result.user.uid, userProfile);

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error
            alert(result.error);
            googleSignupBtn.innerHTML = originalButtonContent;
            googleSignupBtn.disabled = false;
        }
    } catch (error) {
        console.error('Google signup error:', error);
        alert('An error occurred during Google sign up. Please try again.');
        googleSignupBtn.innerHTML = originalButtonContent;
        googleSignupBtn.disabled = false;
    }
});
