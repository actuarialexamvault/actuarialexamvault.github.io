// Sign in form functionality
const authManager = new AuthManager();

const signinForm = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signinButton = document.querySelector('.btn-signin');
const togglePasswordButton = document.getElementById('togglePassword');

// Check if user is already logged in
if (authManager.isLoggedIn()) {
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
signinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Show loading state
    const originalButtonContent = signinButton.innerHTML;
    signinButton.innerHTML = '<span>Signing in...</span>';
    signinButton.disabled = true;
    
    // Simulate API delay
    setTimeout(() => {
        const result = authManager.signIn(email, password);
        
        if (result.success) {
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error with more helpful information
            let errorMessage = result.message;
            
            // If email not found, check if any users exist
            if (result.message === 'Email not found') {
                if (!authManager.hasUsers()) {
                    errorMessage = 'Email not found.\n\n' +
                                 'No accounts exist yet on this server.\n' +
                                 'Please create a new account first.\n\n' +
                                 'Note: Accounts created when opening HTML files directly\n' +
                                 '(file:// protocol) are stored separately from accounts\n' +
                                 'created on localhost (http:// protocol).';
                } else {
                    errorMessage = 'Email not found.\n\n' +
                                 'This email is not registered.\n' +
                                 'Please check your email or create a new account.';
                }
            }
            
            alert(errorMessage);
            signinButton.innerHTML = originalButtonContent;
            validateForm();
        }
    }, 500);
});

// Handle forgot password link
document.querySelector('.forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Password reset functionality: In a production app, this would send a password reset email.');
});
