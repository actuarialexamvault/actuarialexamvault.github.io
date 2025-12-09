// Sign up form functionality
const authManager = new AuthManager();

const signupForm = document.getElementById('signupForm');
const fullnameInput = document.getElementById('fullname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const signupButton = document.querySelector('.btn-signin');
const togglePasswordButton = document.getElementById('togglePassword');
const toggleConfirmPasswordButton = document.getElementById('toggleConfirmPassword');

// Error message elements
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');

// Check if user is already logged in
if (authManager.isLoggedIn()) {
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
    const fullnameValid = fullnameInput.value.trim() !== '';
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
    if (fullnameValid && emailValid && passwordValid && confirmPasswordValid && isValid) {
        signupButton.disabled = false;
    } else {
        signupButton.disabled = true;
    }

    return isValid;
}

// Listen for input changes
fullnameInput.addEventListener('input', validateForm);
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
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Show loading state
    const originalButtonContent = signupButton.innerHTML;
    signupButton.innerHTML = '<span>Creating account...</span>';
    signupButton.disabled = true;

    // Simulate API delay
    setTimeout(() => {
        const result = authManager.register(fullname, email, password);

        if (result.success) {
            // Show success message
            alert('Account created successfully! Please sign in.');
            // Redirect to sign in page
            window.location.href = 'signin.html';
        } else {
            // Show error message
            emailError.textContent = result.message;
            signupButton.innerHTML = originalButtonContent;
            signupButton.disabled = false;
        }
    }, 500);
});
