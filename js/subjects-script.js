// Subjects page functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';

// Initialize activity monitor
initActivityMonitor();

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
    
    if (result.success && result.data.fullname) {
        userName.textContent = result.data.fullname;
    } else {
        userName.textContent = user.email;
    }
}

// Handle sign out
signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        await firebaseAuth.signout();
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
