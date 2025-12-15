// Landing page functionality
const authManager = new AuthManager();

const statusBadge = document.getElementById('statusBadge');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const ctaButtons = document.querySelector('.cta-buttons');

// Check authentication status
function updateAuthStatus() {
    // Check if required elements exist (they may not exist on simple landing page)
    if (!statusBadge || !userInfo || !userName || !ctaButtons) {
        return;
    }
    const session = authManager.getSession();
    
    if (session) {
        // User is logged in - show ONLINE status
        statusBadge.textContent = 'ONLINE';
        statusBadge.classList.add('online');
        statusBadge.classList.remove('offline');
        
        // Show user info
        userName.textContent = session.fullname;
        userInfo.style.display = 'flex';
        
        // Hide CTA buttons or change them to "Go to Dashboard"
        ctaButtons.innerHTML = `
            <a href="pages/dashboard.html" class="btn btn-primary">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Go to Dashboard
            </a>
        `;
        
        // Update session timer
        updateSessionTimer();
        
    } else {
        // User is not logged in - show OFFLINE status
        statusBadge.textContent = 'OFFLINE';
        statusBadge.classList.add('offline');
        statusBadge.classList.remove('online');
        
        // Hide user info
        userInfo.style.display = 'none';
    }
}

// Update session timer display
function updateSessionTimer() {
    const timeRemaining = authManager.getSessionTimeRemaining();
    
    if (timeRemaining > 0) {
        statusBadge.title = `Session expires in ${timeRemaining} minutes`;
        
        // Check again in 1 minute
        setTimeout(() => {
            updateSessionTimer();
            
            // Refresh auth status to check if session expired
            if (authManager.getSessionTimeRemaining() === 0) {
                updateAuthStatus();
                alert('Your session has expired. Please sign in again.');
            }
        }, 60000); // 1 minute
    }
}

// Handle sign out
if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authManager.signOut();
        updateAuthStatus();
        alert('You have been signed out successfully.');
        
        // Restore original CTA buttons
        if (ctaButtons) {
            ctaButtons.innerHTML = `
                <a href="signin.html" class="btn btn-primary">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Sign In
                </a>
                <a href="signin.html" class="btn btn-secondary">Sign in with Email</a>
            `;
        }
    });
}

// Initialize on page load
updateAuthStatus();

// Extend session on user activity
let activityTimeout;
function resetActivityTimer() {
    clearTimeout(activityTimeout);
    
    if (authManager.isLoggedIn()) {
        authManager.extendSession();
        
        // Set timeout to check for inactivity (5 minutes)
        activityTimeout = setTimeout(() => {
            console.log('User inactive - session will expire as scheduled');
        }, 5 * 60 * 1000);
    }
}

// Listen for user activity
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetActivityTimer, true);
});

// Initial activity timer
resetActivityTimer();
