// Question Grading functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

let currentUser = null;
let isAuthChecked = false;

// Modal functions
function showModal(title, message, type = 'info', buttons = [{ text: 'OK', primary: true, callback: null }]) {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalIcon = document.getElementById('modalIcon');
    const btnPrimary = document.getElementById('modalBtnPrimary');
    const btnSecondary = document.getElementById('modalBtnSecondary');
    
    // Set content
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;
    
    // Set icon type
    modalIcon.className = `modal-icon ${type}`;
    
    // Setup buttons
    if (buttons.length === 1) {
        btnPrimary.textContent = buttons[0].text;
        btnPrimary.onclick = () => {
            hideModal();
            if (buttons[0].callback) buttons[0].callback();
        };
        btnSecondary.style.display = 'none';
    } else if (buttons.length === 2) {
        btnPrimary.textContent = buttons[0].text;
        btnPrimary.onclick = () => {
            hideModal();
            if (buttons[0].callback) buttons[0].callback();
        };
        btnSecondary.textContent = buttons[1].text;
        btnSecondary.style.display = 'inline-block';
        btnSecondary.onclick = () => {
            hideModal();
            if (buttons[1].callback) buttons[1].callback();
        };
    }
    
    // Show modal
    modal.style.display = 'flex';
}

function hideModal() {
    const modal = document.getElementById('customModal');
    modal.style.display = 'none';
}

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAuthChecked = true;
        // Initialize page after authentication
        await initializePage();
    } else {
        if (isAuthChecked || !user) {
            setTimeout(() => {
                if (!auth.currentUser) {
                    alert('Please sign in to access question grading.');
                    window.location.href = 'signin.html';
                }
            }, 500);
        }
    }
});

// Get question details from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const subjectTitle = urlParams.get('subjectTitle');
const sessionType = urlParams.get('session');
const year = urlParams.get('year');
const paper = urlParams.get('paper');
const questionNumber = urlParams.get('question');
const maxMarks = parseInt(urlParams.get('maxMarks') || '0');
const isAIReview = urlParams.get('isAIReview') === 'true';

// DOM elements
const signOutBtn = document.getElementById('signOutBtn');
const keyIdeasSlider = document.getElementById('keyIdeasSlider');
const useOfInfoSlider = document.getElementById('useOfInfoSlider');
const concisenessSlider = document.getElementById('concisenessSlider');
const ideaGenerationSlider = document.getElementById('ideaGenerationSlider');
const keyIdeasValue = document.getElementById('keyIdeasValue');
const useOfInfoValue = document.getElementById('useOfInfoValue');
const concisenessValue = document.getElementById('concisenessValue');
const ideaGenerationValue = document.getElementById('ideaGenerationValue');
const totalMarksInput = document.getElementById('totalMarksInput');
const marksInput = document.getElementById('marksInput');
const totalMarksHint = document.getElementById('totalMarksHint');
const calculatedGrade = document.getElementById('calculatedGrade');
const calculatedPercentage = document.getElementById('calculatedPercentage');
const completeReviewBtn = document.getElementById('completeReviewBtn');
const backBtn = document.getElementById('backBtn');

// Initialize page after auth check
async function initializePage() {
    setupSliders();
    setupMarksInput();
    setupEventListeners();
    await loadExistingGrade();
}

// Setup sliders
function setupSliders() {
    // Key Ideas
    keyIdeasSlider.addEventListener('input', function() {
        keyIdeasValue.textContent = `${this.value}/10`;
        calculateSuggestedGrade();
    });

    // Use of Information
    useOfInfoSlider.addEventListener('input', function() {
        useOfInfoValue.textContent = `${this.value}/10`;
        calculateSuggestedGrade();
    });

    // Conciseness
    concisenessSlider.addEventListener('input', function() {
        concisenessValue.textContent = `${this.value}/10`;
        calculateSuggestedGrade();
    });

    // Idea Generation
    ideaGenerationSlider.addEventListener('input', function() {
        ideaGenerationValue.textContent = `${this.value}/10`;
        calculateSuggestedGrade();
    });
}

// Setup marks input
function setupMarksInput() {
    // Set default total marks from URL or 0
    totalMarksInput.value = maxMarks;
    totalMarksHint.textContent = maxMarks || '0';

    // Total marks input listener
    totalMarksInput.addEventListener('input', function() {
        // Validate input - allow 0 or positive values
        if (parseFloat(this.value) < 0) {
            this.value = 0;
        }
        
        // Update hint and recalculate grade
        totalMarksHint.textContent = this.value;
        autoCalculateGrade();
    });

    // Marks awarded input listener
    marksInput.addEventListener('input', function() {
        const totalMarks = parseFloat(totalMarksInput.value) || 0;
        
        // Validate input
        if (parseFloat(this.value) > totalMarks) {
            this.value = totalMarks;
        }
        if (parseFloat(this.value) < 0) {
            this.value = 0;
        }
        
        // Auto-calculate grade based on marks
        autoCalculateGrade();
    });
}

// Calculate suggested grade based on dimension scores
function calculateSuggestedGrade() {
    const keyIdeas = parseInt(keyIdeasSlider.value);
    const useOfInfo = parseInt(useOfInfoSlider.value);
    const conciseness = parseInt(concisenessSlider.value);
    const ideaGeneration = parseInt(ideaGenerationSlider.value);
    
    // Calculate average score (out of 10)
    const avgScore = (keyIdeas + useOfInfo + conciseness + ideaGeneration) / 4;
    
    // Convert to percentage
    const percentage = (avgScore / 10) * 100;
    
    // Get total marks
    const totalMarks = parseFloat(totalMarksInput.value) || 0;
    
    // Only suggest marks if total marks is set
    if (totalMarks > 0) {
        // Suggest marks based on percentage
        const suggestedMarks = ((percentage / 100) * totalMarks).toFixed(1);
        
        // Auto-populate marks if empty
        if (!marksInput.value || marksInput.value === '0') {
            marksInput.value = suggestedMarks;
            autoCalculateGrade();
        }
    }
}

// Auto-calculate grade based on marks entered
function autoCalculateGrade() {
    const marksAwarded = parseFloat(marksInput.value) || 0;
    const totalMarks = parseFloat(totalMarksInput.value) || 0;
    
    // Can't calculate percentage if total marks is 0
    if (totalMarks === 0) {
        calculatedGrade.textContent = '-';
        calculatedPercentage.textContent = '-';
        return;
    }
    
    const percentage = (marksAwarded / totalMarks) * 100;
    
    let grade = '';
    let gradeDescription = '';
    
    if (percentage >= 60) {
        grade = 'P';
        gradeDescription = 'Pass (60% and above)';
    } else if (percentage >= 50) {
        grade = 'FA';
        gradeDescription = 'Fail A (50% to 60%)';
    } else if (percentage >= 40) {
        grade = 'FB';
        gradeDescription = 'Fail B (40% to 50%)';
    } else if (percentage >= 30) {
        grade = 'FC';
        gradeDescription = 'Fail C (30% to 40%)';
    } else {
        grade = 'FD';
        gradeDescription = 'Fail D (Less than 30%)';
    }
    
    // Update the display
    if (marksAwarded > 0) {
        calculatedGrade.textContent = grade;
        calculatedPercentage.textContent = `${percentage.toFixed(1)}% - ${gradeDescription}`;
    } else {
        calculatedGrade.textContent = '-';
        calculatedPercentage.textContent = '-';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sign out
    signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to sign out?')) {
            try {
                await firebaseAuth.signOut();
                alert('You have been signed out successfully.');
                window.location.href = '../index.html';
            } catch (error) {
                console.error('Sign out error:', error);
                alert('Error signing out. Please try again.');
            }
        }
    });

    // Complete Review
    completeReviewBtn.addEventListener('click', async () => {
        await completeReview();
    });

    // Back button
    backBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            subject: subject,
            subjectTitle: subjectTitle,
            session: sessionType,
            year: year,
            paper: paper
        });
        window.location.href = `exam-review.html?${params.toString()}`;
    });
}

// Complete review and save data
async function completeReview() {
    // Get calculated values
    const marksAwarded = parseFloat(marksInput.value);
    const totalMarks = parseFloat(totalMarksInput.value);
    const grade = calculatedGrade.textContent;
    const percentage = calculatedPercentage.textContent;
    
    // Validate inputs
    if (grade === '-' || !grade) {
        showModal(
            'Incomplete Grading',
            'Please enter marks to calculate a grade before completing the review.',
            'error'
        );
        return;
    }
    
    if (isNaN(marksAwarded) || marksAwarded < 0 || marksAwarded > totalMarks) {
        showModal(
            'Invalid Marks',
            `Please enter a valid mark between 0 and ${totalMarks}.`,
            'error'
        );
        return;
    }
    
    if (isNaN(totalMarks) || totalMarks < 1) {
        showModal(
            'Invalid Total Marks',
            'Please enter a valid total marks value.',
            'error'
        );
        return;
    }
    
    // Get dimension scores
    const dimensions = {
        keyIdeas: parseInt(keyIdeasSlider.value),
        useOfInfo: parseInt(useOfInfoSlider.value),
        conciseness: parseInt(concisenessSlider.value),
        ideaGeneration: parseInt(ideaGenerationSlider.value)
    };
    
    // Create summary for confirmation
    const summaryHTML = `
        <div style="text-align: left; margin: 1rem 0;">
            <p style="margin-bottom: 0.5rem;"><strong>Question:</strong> ${subjectTitle} - ${sessionType.toUpperCase()} ${year} Paper ${paper} Q${questionNumber}</p>
            <p style="margin-bottom: 0.5rem;"><strong>Marks:</strong> ${marksAwarded} / ${totalMarks}</p>
            <p style="margin-bottom: 0.5rem;"><strong>Grade:</strong> ${grade} (${percentage})</p>
        </div>
        <p style="margin-top: 1rem;">Are you ready to finalize this grading, or would you like to edit your review?</p>
    `;
    
    // Show confirmation modal
    showModal(
        'Confirm Grading',
        summaryHTML,
        'info',
        [
            { 
                text: 'Confirm Grading', 
                primary: true, 
                callback: () => {
                    // Create grading record
                    const gradingData = {
                        subject: subject,
                        subjectTitle: subjectTitle,
                        session: sessionType,
                        year: parseInt(year),
                        paper: paper,
                        question: questionNumber,
                        dimensions: dimensions,
                        grade: grade,
                        marks: marksAwarded,
                        maxMarks: totalMarks,
                        isAIReviewed: isAIReview,
                        timestamp: new Date().toISOString(),
                        studentEmail: currentUser.email
                    };
                    
                    // Save to Firestore and IndexedDB
                    saveGradingData(gradingData).then(() => {
                        console.log('Grading data saved successfully');
                    }).catch(error => {
                        console.error('Error saving grading data:', error);
                    });
                    
                    // Show success message and redirect
                    showModal(
                        'Review Completed!',
                        'Your grading has been saved successfully.',
                        'success',
                        [{ 
                            text: 'Return to Exam Review', 
                            primary: true, 
                            callback: () => {
                                const params = new URLSearchParams({
                                    subject: subject,
                                    subjectTitle: subjectTitle,
                                    session: sessionType,
                                    year: year,
                                    paper: paper
                                });
                                window.location.href = `exam-review.html?${params.toString()}`;
                            }
                        }]
                    );
                }
            },
            { 
                text: 'Edit Review', 
                primary: false, 
                callback: null 
            }
        ]
    );
}

// Save grading data to Firestore and IndexedDB
async function saveGradingData(gradingData) {
    try {
        // Save to Firestore
        await firestoreData.saveQuestionGrade(currentUser.uid, gradingData);
        
        // Also save to IndexedDB for offline access
        await indexedDBStorage.saveQuestionGrade(currentUser.uid, gradingData);
        
        console.log('Question grading saved successfully');
    } catch (error) {
        console.error('Error saving question grading:', error);
        // Fallback to IndexedDB only if Firestore fails
        try {
            await indexedDBStorage.saveQuestionGrade(currentUser.uid, gradingData);
            console.log('Grading saved to IndexedDB (offline mode)');
        } catch (idbError) {
            console.error('Error saving to IndexedDB:', idbError);
            throw new Error('Failed to save grading data');
        }
    }
}

// Load existing grade if available
async function loadExistingGrade() {
    let existingGrade = null;
    
    try {
        // Try to load from Firestore first
        let gradings = await firestoreData.getQuestionGrades(currentUser.uid);
        
        // Fallback to IndexedDB if Firestore fails
        if (!gradings || gradings.length === 0) {
            gradings = await indexedDBStorage.getQuestionGrades(currentUser.uid);
        }
        
        existingGrade = gradings.find(g => 
            g.subject === subject &&
            g.year == year &&
            g.session.toUpperCase() === sessionType.toUpperCase() &&
            g.paper == paper &&
            g.question == questionNumber
        );
    } catch (error) {
        console.error('Error loading existing grade:', error);
        // Continue without loading previous grade
    }
    
    if (existingGrade) {
        // Populate sliders
        keyIdeasSlider.value = existingGrade.dimensions.keyIdeas;
        useOfInfoSlider.value = existingGrade.dimensions.useOfInfo;
        concisenessSlider.value = existingGrade.dimensions.conciseness;
        ideaGenerationSlider.value = existingGrade.dimensions.ideaGeneration;
        
        // Update display values
        keyIdeasValue.textContent = `${existingGrade.dimensions.keyIdeas}/10`;
        useOfInfoValue.textContent = `${existingGrade.dimensions.useOfInfo}/10`;
        concisenessValue.textContent = `${existingGrade.dimensions.conciseness}/10`;
        ideaGenerationValue.textContent = `${existingGrade.dimensions.ideaGeneration}/10`;
        
        // Populate total marks and marks awarded
        totalMarksInput.value = existingGrade.maxMarks;
        totalMarksHint.textContent = existingGrade.maxMarks;
        marksInput.value = existingGrade.marks;
        
        // Recalculate and display the grade
        autoCalculateGrade();
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('customModal');
    if (event.target === modal) {
        hideModal();
    }
});

// Activity monitoring is handled by activity-monitor.js imported at the top
