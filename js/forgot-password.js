document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotForm');
    const message = document.getElementById('message');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        message.textContent = '';
        const email = form.email.value.trim();

        if (!email) {
            message.textContent = 'Please enter a valid email address.';
            return;
        }

        // Simulate API call
        try {
            message.textContent = 'Sending reset link...';
            await new Promise(res => setTimeout(res, 1000));

            // For now, just show success. Integrate with Firebase/Auth later.
            message.textContent = 'If an account with that email exists, a reset link has been sent.';
            form.reset();
            console.log('Forgot password requested for:', email);
        } catch (err) {
            console.error(err);
            message.textContent = 'An error occurred. Please try again later.';
        }
    });
});