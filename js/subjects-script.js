// Subjects page functionality
const authManager = new AuthManager();

const userName = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const subjectCards = document.querySelectorAll('.subject-card');

// Check if user is logged in
const session = authManager.getSession();
if (!session) {
    alert('Please sign in to access subjects.');
    window.location.href = 'signin.html';
} else {
    userName.textContent = session.fullname;
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

// Handle subject card clicks
subjectCards.forEach(card => {
    card.addEventListener('click', () => {
        const subject = card.dataset.subject;
        const subjectTitle = card.querySelector('.subject-title').textContent;
        
        // Show loading state
        showLoading();
        
        // Store selected subject
        sessionStorage.setItem('selectedSubject', subject);
        sessionStorage.setItem('selectedSubjectTitle', subjectTitle);
        
        // Redirect to subject papers page
        setTimeout(() => {
            window.location.href = `subject-papers.html?subject=${subject}`;
        }, 500);
    });
});

// Show loading overlay
function showLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
}

// Extend session on activity
let activityTimeout;
function resetActivityTimer() {
    clearTimeout(activityTimeout);
    
    if (authManager.isLoggedIn()) {
        authManager.extendSession();
        
        activityTimeout = setTimeout(() => {
            console.log('User inactive');
        }, 5 * 60 * 1000);
    }
}

['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetActivityTimer, true);
});

resetActivityTimer();
