// Dashboard functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';

const userName = document.getElementById('userName');
const userNameTitle = document.getElementById('userNameTitle');
const signOutBtn = document.getElementById('signOutBtn');
const continueSection = document.getElementById('continueSection');
const continueCard = document.getElementById('continueCard');
const continueSubject = document.getElementById('continueSubject');
const themeToggle = document.getElementById('themeToggle');

// Theme management
function initTheme(user) {
    // Load theme preference from Firebase
    themeManager.init();
    
    // Add theme toggle event listener
    themeToggle.addEventListener('click', () => {
        themeManager.toggleTheme(user);
    });
}

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
                initTheme(retryUser);
            }
        }, 1000);
    } else {
        await loadUserProfile(user);
        initTheme(user);
    }
}

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
        userNameTitle.textContent = displayName;
    } else {
        // Fallback to email if no profile data
        userName.textContent = user.email;
        userNameTitle.textContent = user.email;
    }
    
    // Load continue section
    await loadContinueSection(user);
}

async function loadContinueSection(user) {
    // Get last accessed subject and chapter from sessionStorage
    let lastSubject = sessionStorage.getItem('selectedSubject');
    let lastSubjectTitle = sessionStorage.getItem('selectedSubjectTitle');
    let lastChapter = sessionStorage.getItem('selectedChapter');
    
    // If not in session, try to get from recent submissions
    if (!lastSubject) {
        const submissions = await firestoreData.getExamSubmissions(user.uid);
        if (submissions.success && submissions.data) {
            const submissionsArray = Object.values(submissions.data);
            if (submissionsArray.length > 0) {
                // Sort by timestamp and get most recent
                const sorted = submissionsArray.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                lastSubject = sorted[0].subject;
                lastSubjectTitle = `${lastSubject}: Continue practicing`;
            }
        }
    }
    
    // Show continue section if we have a last subject
    if (lastSubject) {
        // Determine the display text based on whether we have chapter info
        if (lastChapter) {
            continueSubject.textContent = `${lastSubjectTitle || lastSubject}: ${lastChapter}`;
        } else {
            continueSubject.textContent = lastSubjectTitle || `${lastSubject}: View your progress`;
        }
        
        continueSection.style.display = 'block';
        
        // Add click handler to navigate to appropriate page
        continueCard.addEventListener('click', (e) => {
            e.preventDefault();
            
            // If user was viewing chapter questions, go back to that chapter
            if (lastChapter) {
                window.location.href = `chapter-questions.html?subject=${encodeURIComponent(lastSubject)}&chapter=${encodeURIComponent(lastChapter)}`;
            } else {
                // Otherwise, go to progress tracker
                sessionStorage.setItem('autoShowSubject', lastSubject);
                sessionStorage.setItem('autoShowSubjectTitle', lastSubjectTitle || lastSubject);
                window.location.href = 'progress-tracker.html';
            }
        });
    }
}

// Initialize
checkAuthAndLoadProfile();

// Handle sign out
const signoutModal = document.getElementById('signoutConfirmModal');
const signoutYes = signoutModal && signoutModal.querySelector('#signoutConfirmYes');
const signoutNo = signoutModal && signoutModal.querySelector('#signoutConfirmNo');

function showSignoutModal() {
    if (!signoutModal) return;
    signoutModal.style.display = 'flex';
}

function hideSignoutModal() {
    if (!signoutModal) return;
    signoutModal.style.display = 'none';
}

if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSignoutModal();
    });
}

if (signoutNo) signoutNo.addEventListener('click', () => hideSignoutModal());
if (signoutYes) signoutYes.addEventListener('click', async () => {
    hideSignoutModal();
    try {
        await firebaseAuth.signout();
    } catch (err) {
        console.error('Sign out failed:', err);
    }
    window.location.href = '../index.html';
});

// Initialize activity monitor for auto-logout
initActivityMonitor();

// Add click handlers for action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        alert('This feature is coming soon! For now, explore the past papers in the workspace.');
    });
});

// Add click handlers for dashboard cards (except those with real navigation targets)
// Allow practice-by-chapter.html as a real link so the Practice card navigates to the new page.
const allowedLinks = new Set([
    'progress-tracker.html',
    'help-support.html',
    'practice.html',
    'practice-by-chapter.html',
    'subjects.html?mode=practice'
]);
document.querySelectorAll('.card-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!allowedLinks.has(href)) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('This feature is coming soon! For now, explore the past papers in the workspace.');
        });
    }
});
