// Forgot Password functionality
import { firebaseAuth } from './firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotForm');
    const message = document.getElementById('message');
    const emailInput = document.getElementById('email');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!form) return;

    // Email validation
    const emailIsValid = (value) => {
        if (!value) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(value);
    };

    // Show message helper
    const showMessage = (text, isError = false) => {
        message.textContent = text;
        message.style.color = isError ? '#dc3545' : 'inherit';
    };

    // Disable/enable form
    const setFormDisabled = (disabled) => {
        if (emailInput) emailInput.disabled = disabled;
        if (submitButton) {
            submitButton.disabled = disabled;
            submitButton.textContent = disabled ? 'Sending...' : 'Send reset link';
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage('');
        
        const email = (emailInput?.value || '').trim();

        if (!emailIsValid(email)) {
            showMessage('Please enter a valid email address.', true);
            return;
        }

        try {
            setFormDisabled(true);
            showMessage('Sending reset link...');
            
            const result = await firebaseAuth.sendPasswordResetEmail(email);

            if (result.success) {
                showMessage('If an account with that email exists, a password reset link has been sent. Please check your email.');
                form.reset();
                console.log('Password reset email sent to:', email);
            } else {
                console.error('Password reset error:', result.error);
                showMessage(result.error || 'Unable to send reset link. Please try again later.', true);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            showMessage('An error occurred. Please try again later.', true);
        } finally {
            setFormDisabled(false);
        }
    });
});