// Subjects page functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
// Backwards-compatible shim: some pages reference a global AuthManager instance
// Ensure a minimal `authManager` exists so older code that calls isLoggedIn()/extendSession() won't crash.
const authManager = window.authManagerInstance || (window.authManagerInstance = {
    isLoggedIn: () => !!(typeof firebaseAuth !== 'undefined' && firebaseAuth.getCurrentUser && firebaseAuth.getCurrentUser()),
    extendSession: () => { /* no-op: firebase handles session */ },
    signOut: async () => { if (typeof firebaseAuth !== 'undefined') await firebaseAuth.signout(); },
    getSession: () => null,
    getSessionTimeRemaining: () => 0
});
import { attachSignOutHandler } from './signout-modal.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

const userName = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const subjectCards = document.querySelectorAll('.subject-card');

let isAuthChecked = false;

// Check if user is logged in and load profile
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        await loadUserProfile(user);
        isAuthChecked = true;
    } else {
        // User is not signed in
        if (isAuthChecked || !user) {
            // Only show alert if auth has been checked or definitely no user
            setTimeout(() => {
                if (!auth.currentUser) {
                    alert('Please sign in to access subjects.');
                    window.location.href = 'signin.html';
                }
            }, 500);
        }
    }
});

async function loadUserProfile(user) {
    // Get user profile from Firestore
    const result = await firestoreData.getUserProfile(user.uid);
    
    if (result.success && result.data) {
        // Display only first name (prefer 'name' field, fallback to splitting 'fullname')
        let displayName;
        if (result.data.name) {
            displayName = result.data.name;
        } else if (result.data.fullname) {
            // For legacy users, extract first name from fullname
            displayName = result.data.fullname.split(' ')[0];
        } else {
            // Final fallback to email
            displayName = user.email;
        }
        userName.textContent = displayName;
    } else {
        userName.textContent = user.email;
    }
}

// Handle sign out
attachSignOutHandler('#signOutBtn');

// Check if we're in practice mode (coming from dashboard practice button)
const urlParams = new URLSearchParams(window.location.search);
const isPracticeMode = urlParams.get('mode') === 'practice';

// If in practice mode, grey out non-F102 subjects and add "Not available" badge
if (isPracticeMode) {
    subjectCards.forEach(card => {
        const subject = card.dataset.subject;
        if (subject !== 'F102') {
            // Grey out the card
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
            card.style.filter = 'grayscale(100%)';
            
            // Add "Not available" badge
            const badge = document.createElement('div');
            badge.style.cssText = `
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: #666;
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
                letter-spacing: 0.5px;
            `;
            badge.textContent = 'NOT AVAILABLE';
            card.style.position = 'relative';
            card.appendChild(badge);
        }
    });
}

// Handle subject card clicks
subjectCards.forEach(card => {
    card.addEventListener('click', () => {
        const subject = card.dataset.subject;
        const subjectTitle = card.querySelector('.subject-title').textContent;
        
        // In practice mode, block clicks on non-F102 subjects
        if (isPracticeMode && subject !== 'F102') {
            return; // Do nothing for non-F102 subjects in practice mode
        }
        
        // Show loading state
        showLoading();
        
        // Store selected subject for compatibility and set auto-show keys so the progress
        // tracker can immediately display the subject's progress (new flow).
        sessionStorage.setItem('selectedSubject', subject);
        sessionStorage.setItem('selectedSubjectTitle', subjectTitle);
        sessionStorage.setItem('autoShowSubject', subject);
        sessionStorage.setItem('autoShowSubjectTitle', subjectTitle);

        // Determine where to redirect based on mode and subject
        let redirectUrl;
        if (isPracticeMode) {
            // If in practice mode and F102, go to practice-by-chapter
            // Otherwise, go to progress tracker (past papers)
            if (subject === 'F102') {
                const params = new URLSearchParams({ subject, subjectTitle });
                redirectUrl = `practice-by-chapter.html?${params.toString()}`;
            } else {
                // For non-F102 subjects, redirect to progress tracker
                redirectUrl = 'progress-tracker.html';
            }
        } else {
            // Default behavior: go to practice-by-chapter
            const params = new URLSearchParams({ subject, subjectTitle });
            redirectUrl = `practice-by-chapter.html?${params.toString()}`;
        }

        // Redirect after loading animation
        setTimeout(() => {
            window.location.href = redirectUrl;
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
