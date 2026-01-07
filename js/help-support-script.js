// Help & Support Page Script with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { attachSignOutHandler } from './signout-modal.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

console.log('[help-support] script loaded');

// Attach sign-out handler early so it still works if later code throws
attachSignOutHandler('#signOutBtn');

let currentUser = null;

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Pre-fill email if user is signed in
        const emailInput = document.getElementById('senderEmail');
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }
    } else {
        setTimeout(() => {
            if (!auth.currentUser) {
                alert('Please sign in to access this page.');
                window.location.href = 'signin.html';
            }
        }, 500);
    }
});

// DOM Elements
const signOutBtn = document.getElementById('signOutBtn');
const contactForm = document.getElementById('contactForm');
const messageTextarea = document.getElementById('message');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');

// Character counter for message textarea (guard in case textarea is absent on this page)
if (messageTextarea) {
    messageTextarea.addEventListener('input', () => {
        const length = messageTextarea.value.length;
        if (charCount) charCount.textContent = length;
        
        if (length > 2000) {
            messageTextarea.value = messageTextarea.value.substring(0, 2000);
            if (charCount) charCount.textContent = '2000';
        }
    });
}

// (sign-out attached above)

// Form submission handler (guard in case contact form is not present on this page)
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const senderName = document.getElementById('senderName').value.trim();
    const senderEmail = document.getElementById('senderEmail').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    
    // Validate form
    if (!senderName || !senderEmail || !subject || !message) {
        showMessage('Please fill in all fields.', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
        showMessage('Please enter a valid email address.', 'error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Sending...
    `;
    
    try {
        // Create mailto link (fallback method)
        const mailtoLink = createMailtoLink(senderName, senderEmail, subject, message);
        
        // Open mailto link
        window.location.href = mailtoLink;
        
        // Show success message
        setTimeout(() => {
            showMessage(
                'Your email client has been opened. Please send the email from your email client. If the email client did not open, please email us directly at actuarial-exam-vault+queries@gmail.com',
                'success'
            );
            
            // Reset form
            contactForm.reset();
            charCount.textContent = '0';
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Send Message
            `;
        }, 1000);
        
    } catch (error) {
        console.error('Error sending message:', error);
        showMessage('Failed to send message. Please try again or email us directly at actuarial-exam-vault+queries@gmail.com', 'error');
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Send Message
        `;
    }
});

// Create mailto link
function createMailtoLink(name, email, subject, message) {
    const to = 'actuarial-exam-vault+queries@gmail.com';
    const emailBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
}

// Show message function
function showMessage(text, type) {
    // Remove any existing message
    const existingMessage = document.querySelector('.message');
    if (existingMessage) existingMessage.remove();

    // Create message element
    const msg = document.createElement('div');
    msg.className = `message message-${type}`;

    const icon = type === 'success'
        ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
             <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1"/>
           </svg>`;

    msg.innerHTML = `${icon}<span>${text}</span>`;
    if (contactForm && contactForm.parentNode) contactForm.parentNode.insertBefore(msg, contactForm);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (msg.parentNode) msg.remove();
    }, 10000);
}

} // end if contactForm

// Add spin animation for loading state
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
