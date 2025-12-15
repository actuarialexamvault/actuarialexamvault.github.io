document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotForm');
    const message = document.getElementById('message');

    if (!form) return;

    const emailIsValid = (value) => {
        if (!value) return false;
        // Simple-but-safe email regex
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(value);
    };

    async function sendResetEmail(email) {
        // If Firebase Auth is present, use it. Otherwise fallback to simulated flow.
        if (window.firebase && firebase.auth && typeof firebase.auth === 'function') {
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message || String(err) };
            }
        }

        // Simulated network call
        await new Promise(res => setTimeout(res, 800));
        return { success: true };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        message.textContent = '';
        const email = (form.email.value || '').trim();

        if (!emailIsValid(email)) {
            message.textContent = 'Please enter a valid email address.';
            return;
        }

        try {
            message.textContent = 'Sending reset link...';
            const result = await sendResetEmail(email);

            if (result.success) {
                message.textContent = 'If an account with that email exists, a reset link has been sent.';
                form.reset();
                console.log('Forgot password requested for:', email);
            } else {
                console.error('Password reset error:', result.error);
                // Provide a friendly message but keep it generic for security
                message.textContent = 'Unable to send reset link. Please try again later.';
            }
        } catch (err) {
            console.error(err);
            message.textContent = 'An error occurred. Please try again later.';
        }
    });
});