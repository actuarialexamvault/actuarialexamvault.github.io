import { themeManager } from './theme-manager.js';
import { attachSignOutHandler } from './signout-modal.js';
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';

themeManager.init();
attachSignOutHandler('#signOutBtn');

// Get current user and display info
async function loadUserInfo() {
    // Wait for auth to be ready
    await firebaseAuth.waitForAuthReady();
    
    const user = firebaseAuth.getCurrentUser();
    if (!user) {
        window.location.href = 'signin.html';
        return;
    }

    // Display user info
    const userEmail = document.getElementById('userEmail');
    const displayName = document.getElementById('displayName');
    const userName = document.getElementById('userName');

    if (userEmail) userEmail.textContent = user.email || 'N/A';
    if (displayName) displayName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    if (userName) userName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
    
    // Load primary exam preference
    await loadPrimaryExam(user.uid);
    
    // Load study plan
    await loadStudyPlan(user.uid);
}

// Load primary exam preference
async function loadPrimaryExam(userId) {
    const primaryExamSelect = document.getElementById('primaryExam');
    if (!primaryExamSelect) return;
    
    try {
        const result = await firestoreData.getUserProfile(userId);
        if (result.success && result.data && result.data.primaryExam) {
            primaryExamSelect.value = result.data.primaryExam;
        }
    } catch (error) {
        console.error('Error loading primary exam:', error);
    }
}

// Load study plan
async function loadStudyPlan(userId) {
    const examDateInput = document.getElementById('examDate');
    const hoursPerDayInput = document.getElementById('hoursPerDay');
    const daysPerWeekInput = document.getElementById('daysPerWeek');
    const studyGoalSelect = document.getElementById('studyGoal');
    
    if (!examDateInput || !hoursPerDayInput || !daysPerWeekInput) return;
    
    try {
        const result = await firestoreData.getUserProfile(userId);
        if (result.success && result.data && result.data.studyPlan) {
            const plan = result.data.studyPlan;
            if (plan.examDate) examDateInput.value = plan.examDate;
            if (plan.hoursPerDay) hoursPerDayInput.value = plan.hoursPerDay;
            if (plan.daysPerWeek) daysPerWeekInput.value = plan.daysPerWeek;
            if (plan.studyGoal && studyGoalSelect) studyGoalSelect.value = plan.studyGoal;
        }
    } catch (error) {
        console.error('Error loading study plan:', error);
    }
}

// Handle primary exam selection
const primaryExamSelect = document.getElementById('primaryExam');
const savePrimaryExamBtn = document.getElementById('savePrimaryExamBtn');

if (primaryExamSelect) {
    let initialValue = primaryExamSelect.value;
    
    primaryExamSelect.addEventListener('change', () => {
        // Show save button if value changed
        if (savePrimaryExamBtn) {
            savePrimaryExamBtn.style.display = primaryExamSelect.value !== initialValue ? 'inline-block' : 'none';
        }
    });
}

if (savePrimaryExamBtn && primaryExamSelect) {
    savePrimaryExamBtn.addEventListener('click', async () => {
        const user = firebaseAuth.getCurrentUser();
        if (!user) {
            alert('You must be signed in to save preferences.');
            return;
        }
        
        try {
            savePrimaryExamBtn.disabled = true;
            savePrimaryExamBtn.textContent = 'Saving...';
            
            // Save to Firestore using saveUserProfile with merge
            const result = await firestoreData.saveUserProfile(user.uid, {
                primaryExam: primaryExamSelect.value
            });
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save');
            }
            
            savePrimaryExamBtn.textContent = 'Saved!';
            setTimeout(() => {
                savePrimaryExamBtn.style.display = 'none';
                savePrimaryExamBtn.textContent = 'Save Changes';
                savePrimaryExamBtn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error saving primary exam:', error);
            alert('Failed to save preference. Please try again.');
            savePrimaryExamBtn.disabled = false;
            savePrimaryExamBtn.textContent = 'Save Changes';
        }
    });
}

// Handle study plan changes
const examDateInput = document.getElementById('examDate');
const hoursPerDayInput = document.getElementById('hoursPerDay');
const daysPerWeekInput = document.getElementById('daysPerWeek');
const studyGoalSelect = document.getElementById('studyGoal');
const saveStudyPlanBtn = document.getElementById('saveStudyPlanBtn');

if (examDateInput && hoursPerDayInput && daysPerWeekInput && saveStudyPlanBtn) {
    const inputs = [examDateInput, hoursPerDayInput, daysPerWeekInput];
    if (studyGoalSelect) inputs.push(studyGoalSelect);
    
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveStudyPlanBtn.style.display = 'block';
        });
    });
    
    saveStudyPlanBtn.addEventListener('click', async () => {
        const user = firebaseAuth.getCurrentUser();
        if (!user) {
            alert('You must be signed in to save your study plan.');
            return;
        }
        
        try {
            saveStudyPlanBtn.disabled = true;
            saveStudyPlanBtn.textContent = 'Saving...';
            
            const studyPlan = {
                examDate: examDateInput.value,
                hoursPerDay: parseFloat(hoursPerDayInput.value) || 0,
                daysPerWeek: parseInt(daysPerWeekInput.value) || 0,
                studyGoal: studyGoalSelect ? studyGoalSelect.value : 'chapters'
            };
            
            const result = await firestoreData.saveUserProfile(user.uid, {
                studyPlan: studyPlan
            });
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save');
            }
            
            saveStudyPlanBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveStudyPlanBtn.style.display = 'none';
                saveStudyPlanBtn.textContent = 'Save Study Plan';
                saveStudyPlanBtn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error saving study plan:', error);
            alert('Failed to save study plan. Please try again.');
            saveStudyPlanBtn.disabled = false;
            saveStudyPlanBtn.textContent = 'Save Study Plan';
        }
    });
}

// Clear history button handler
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const confirmModal = document.getElementById('confirmModal');
const cancelBtn = document.getElementById('cancelBtn');
const confirmClearBtn = document.getElementById('confirmClearBtn');

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
        confirmModal.style.display = 'flex';
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });
}

if (confirmClearBtn) {
    confirmClearBtn.addEventListener('click', async () => {
        try {
            const user = firebaseAuth.getCurrentUser();
            if (!user) {
                alert('You must be signed in to clear history.');
                return;
            }

            // Show loading state
            confirmClearBtn.disabled = true;
            confirmClearBtn.textContent = 'Clearing...';

            // Clear from Firestore
            try {
                await firestoreData.clearAllGrades(user.uid);
                console.log('Cleared grades from Firestore');
            } catch (error) {
                console.error('Error clearing Firestore grades:', error);
            }

            // Clear from IndexedDB
            try {
                await indexedDBStorage.clearAllGrades(user.uid);
                console.log('Cleared grades from IndexedDB');
            } catch (error) {
                console.error('Error clearing IndexedDB grades:', error);
            }

            // Clear localStorage drafts
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('draft_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log('Cleared', keysToRemove.length, 'drafts from localStorage');

            // Success
            confirmModal.style.display = 'none';
            confirmClearBtn.disabled = false;
            confirmClearBtn.textContent = 'Yes, Clear Everything';
            
            alert('All attempt history has been cleared successfully!');
            
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('An error occurred while clearing history. Please try again.');
            confirmClearBtn.disabled = false;
            confirmClearBtn.textContent = 'Yes, Clear Everything';
        }
    });
}

// Close modal when clicking outside
if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.style.display = 'none';
        }
    });
}

// Initialize page
loadUserInfo();
