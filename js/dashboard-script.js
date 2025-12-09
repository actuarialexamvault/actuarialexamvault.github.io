// Dashboard functionality
const authManager = new AuthManager();

const userName = document.getElementById('userName');
const userNameTitle = document.getElementById('userNameTitle');
const signOutBtn = document.getElementById('signOutBtn');
const sessionTimer = document.getElementById('sessionTimer');

// Check if user is logged in
const session = authManager.getSession();
if (!session) {
    // Redirect to sign in if not logged in
    alert('Please sign in to access the dashboard.');
    window.location.href = 'signin.html';
} else {
    // Display user info
    userName.textContent = session.fullname;
    userNameTitle.textContent = session.fullname;
    
    // Update session timer
    updateSessionTimer();
}

// Update session timer display
function updateSessionTimer() {
    const timeRemaining = authManager.getSessionTimeRemaining();
    
    if (timeRemaining > 0) {
        sessionTimer.textContent = `${timeRemaining} minutes`;
        
        // Update every minute
        setTimeout(() => {
            updateSessionTimer();
        }, 60000);
    } else {
        // Session expired
        alert('Your session has expired. Please sign in again.');
        authManager.signOut();
        window.location.href = 'signin.html';
    }
}

// Handle sign out
signOutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        authManager.signOut();
        alert('You have been signed out successfully.');
        window.location.href = '../index.html';
    }
});

// Extend session on user activity
let activityTimeout;
function resetActivityTimer() {
    clearTimeout(activityTimeout);
    
    if (authManager.isLoggedIn()) {
        authManager.extendSession();
        console.log('Session extended due to activity');
        
        // Update timer display
        updateSessionTimer();
        
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

// Add click handlers for action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        alert('This feature is coming soon! For now, explore the past papers in the workspace.');
    });
});

// Add click handlers for dashboard cards (except Past Papers and Progress Tracker which have real links)
document.querySelectorAll('.card-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href !== 'subjects.html' && href !== 'progress-tracker.html') {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('This feature is coming soon! For now, explore the past papers in the workspace.');
        });
    }
});
