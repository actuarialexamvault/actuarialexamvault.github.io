// Dashboard functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';

const userName = document.getElementById('userName');
const userNameTitle = document.getElementById('userNameTitle');
const signOutBtn = document.getElementById('signOutBtn');

// Check if user is logged in and load profile
async function checkAuthAndLoadProfile() {
    const user = firebaseAuth.getCurrentUser();
    
    if (!user) {
        // Wait a moment for Firebase to initialize
        setTimeout(async () => {
            const retryUser = firebaseAuth.getCurrentUser();
            if (!retryUser) {
                alert('Please sign in to access the dashboard.');
                window.location.href = 'signin.html';
            } else {
                await loadUserProfile(retryUser);
            }
        }, 1000);
    } else {
        await loadUserProfile(user);
    }
}

async function loadUserProfile(user) {
    // Get user profile from Firestore
    const result = await firestoreData.getUserProfile(user.uid);
    
    if (result.success && result.data.fullname) {
        // Display user info
        userName.textContent = result.data.fullname;
        userNameTitle.textContent = result.data.fullname;
    } else {
        // Fallback to email if no full name
        userName.textContent = user.email;
        userNameTitle.textContent = user.email;
    }
}

// Initialize
checkAuthAndLoadProfile();

// Handle sign out
signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        await firebaseAuth.signout();
        alert('You have been signed out successfully.');
        window.location.href = '../index.html';
    }
});

// Initialize activity monitor for auto-logout
initActivityMonitor();

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
