// Exam Review functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { getExaminersReportLink, hasExaminersReport } from './memo-links.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

let currentUser = null;
let isAuthChecked = false;

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
                    alert('Please sign in to access exam reviews.');
                    window.location.href = 'signin.html';
                }
            }, 500);
        }
    }
});

// Modal management
let currentQuestionNumber = null;
let deleteConfirmResolve = null;

// Modal functions
function showReviewTypeModal(questionNumber) {
    currentQuestionNumber = questionNumber;
    const modal = document.getElementById('reviewTypeModal');
    modal.style.display = 'flex';
}

function hideReviewTypeModal() {
    const modal = document.getElementById('reviewTypeModal');
    modal.style.display = 'none';
}

function showAiInstructionsModal() {
    const modal = document.getElementById('aiInstructionsModal');
    modal.style.display = 'flex';
}

function hideAiInstructionsModal() {
    const modal = document.getElementById('aiInstructionsModal');
    modal.style.display = 'none';
}

function showDeleteConfirmModal(questionNumber) {
    return new Promise((resolve) => {
        deleteConfirmResolve = resolve;
        const modal = document.getElementById('deleteConfirmModal');
        const message = document.getElementById('deleteConfirmMessage');
        message.textContent = `Question ${questionNumber} has been graded. Removing it will delete the saved grade. Continue?`;
        modal.style.display = 'flex';
    });
}

function hideDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'none';
}

// Get exam details from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const subjectTitle = urlParams.get('subjectTitle');
const sessionType = urlParams.get('session');
const year = urlParams.get('year');
const paper = urlParams.get('paper');

// DOM elements
const signOutBtn = document.getElementById('signOutBtn');
const reviewTitle = document.getElementById('reviewTitle');
const reviewSubtitle = document.getElementById('reviewSubtitle');
const submissionDate = document.getElementById('submissionDate');
const downloadAttemptBtn = document.getElementById('downloadAttemptBtn');
const downloadMemoBtn = document.getElementById('downloadMemoBtn');
const addRowBtn = document.getElementById('addRowBtn');
const removeRowBtn = document.getElementById('removeRowBtn');
const gradingTableBody = document.getElementById('gradingTableBody');
const backBtn = document.getElementById('backBtn');

// Modal elements
const reviewTypeModal = document.getElementById('reviewTypeModal');
const selfReviewBtn = document.getElementById('selfReviewBtn');
const aiReviewBtn = document.getElementById('aiReviewBtn');
const aiInstructionsModal = document.getElementById('aiInstructionsModal');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const closeAiInstructionsBtn = document.getElementById('closeAiInstructionsBtn');
const aiPromptText = document.getElementById('aiPromptText');

// Initialize page
let questionCount = 8; // Default 8 questions
let submissionData = null;

// Get storage key for question count
function getQuestionCountStorageKey() {
    return `questionCount_${subject}_${year}_${sessionType}_P${paper}`;
}

// Load question count from localStorage
function loadQuestionCount() {
    const storageKey = getQuestionCountStorageKey();
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : 8; // Default to 8 if not found
}

// Save question count to localStorage
function saveQuestionCount(count) {
    const storageKey = getQuestionCountStorageKey();
    localStorage.setItem(storageKey, count.toString());
}

// Initialize page after auth check
async function initializePage() {
    // Load the saved question count
    questionCount = loadQuestionCount();
    setupEventListeners();
    await loadExamDetails();
    await initializeTable();
}

// Load exam details
async function loadExamDetails() {
    // Update title
    reviewTitle.textContent = `${subjectTitle} - ${sessionType} ${year} Paper ${paper}`;
    reviewSubtitle.textContent = 'Review your exam attempt and grade your answers';
    
    // Update download memo button based on report availability
    if (!hasExaminersReport(subject, sessionType, year, paper)) {
        downloadMemoBtn.disabled = true;
        downloadMemoBtn.title = "Examiner's report not yet available for this exam. Check the actuarial society website for updates";
        downloadMemoBtn.style.opacity = '0.5';
        downloadMemoBtn.style.cursor = 'not-allowed';
    } else {
        downloadMemoBtn.disabled = false;
        downloadMemoBtn.title = "Download Examiner's Report";
        downloadMemoBtn.style.opacity = '1';
        downloadMemoBtn.style.cursor = 'pointer';
    }
    
    // Get submission data from Firestore
    submissionData = await getSubmissionData();
    
    if (submissionData) {
        const date = new Date(submissionData.timestamp);
        submissionDate.textContent = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        submissionDate.textContent = 'Submission not found';
    }
}

// Get submission data from Firestore
async function getSubmissionData() {
    if (!currentUser) return null;
    
    try {
        const submissions = await firestoreData.getUserSubmissions(currentUser.uid);
        
        return submissions.find(sub => 
            sub.subject === subject &&
            sub.year == year &&
            sub.session.toUpperCase() === sessionType.toUpperCase() &&
            sub.paper == paper
        );
    } catch (error) {
        console.error('Error loading submission:', error);
        return null;
    }
}

// Initialize table with default 8 questions
async function initializeTable() {
    gradingTableBody.innerHTML = '';
    
    // Load existing gradings from Firestore
    const existingGradings = await loadExistingGradings();
    
    // Add total row first
    addTotalRow(existingGradings);
    
    for (let i = 1; i <= questionCount; i++) {
        addQuestionRow(i, existingGradings);
    }
}

// Calculate grade from percentage
function calculateGradeFromPercentage(percentage) {
    if (percentage >= 60) {
        return 'P';
    } else if (percentage >= 50) {
        return 'FA';
    } else if (percentage >= 40) {
        return 'FB';
    } else if (percentage >= 30) {
        return 'FC';
    } else {
        return 'FD';
    }
}

// Add total row
function addTotalRow(existingGradings = []) {
    const row = document.createElement('tr');
    row.classList.add('total-row');
    row.id = 'totalRow';
    
    // Calculate totals - marks awarded and available marks per question
    let totalMarksAwarded = 0;
    let sumOfAvailableMarks = 0;
    
    existingGradings.forEach(g => {
        if (g.marks !== undefined) {
            totalMarksAwarded += parseFloat(g.marks) || 0;
        }
        if (g.maxMarks !== undefined) {
            sumOfAvailableMarks += parseFloat(g.maxMarks) || 0;
        }
    });
    
    // Determine denominator for score display and percentage calculation
    // If available marks exceed 100, use that value; otherwise use 100
    const scoreDenominator = sumOfAvailableMarks > 100 ? sumOfAvailableMarks : 100;
    const percentage = (totalMarksAwarded / scoreDenominator) * 100;
    const grade = totalMarksAwarded > 0 ? calculateGradeFromPercentage(percentage) : '—';
    const scoreDisplay = `${totalMarksAwarded.toFixed(1)}/${scoreDenominator.toFixed(1)}`;
    
    // Check if sum of available marks exceeds 100 (strictly greater than)
    const warningClass = sumOfAvailableMarks > 100 ? 'total-warning' : '';
    const warningIcon = sumOfAvailableMarks > 100 ? 
        `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; margin-left: 5px; vertical-align: middle; color: #ffc107;" title="Sum of available marks (${sumOfAvailableMarks.toFixed(1)}) exceeds 100!"><path d="M12 2L2 22H22L12 2Z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 9V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>` : '';
    
    // Always display sum of available marks, with warning styling if it exceeds 100
    const warningStyle = sumOfAvailableMarks > 100 ? 'color: #ffc107;' : 'color: rgba(255,255,255,0.7);';
    const warningPrefix = sumOfAvailableMarks > 100 ? '⚠️ ' : '';
    const availableMarksInfo = 
        `<div style="font-size: 0.75em; ${warningStyle} margin-top: 2px;">${warningPrefix}Total Available Marks: ${sumOfAvailableMarks.toFixed(1)}</div>`;
    
    row.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td colspan="2" class="question-cell">
            <div class="question-title"><strong>Overall Exam Performance</strong></div>
            ${availableMarksInfo}
        </td>
        <td class="score-cell ${warningClass}">
            <strong>${scoreDisplay}</strong>${warningIcon}
        </td>
        <td class="grade-cell">
            <strong>${grade}</strong>
            ${percentage > 0 ? `<span style="font-size: 0.85em; color: rgba(255,255,255,0.8);"> (${percentage.toFixed(1)}%)</span>` : ''}
        </td>
        <td></td>
    `;
    
    gradingTableBody.appendChild(row);
}

// Update the total row with current gradings
async function updateTotalRow() {
    const existingGradings = await loadExistingGradings();
    const totalRow = document.getElementById('totalRow');
    if (totalRow) {
        // Remove old total row
        totalRow.remove();
    }
    // Add updated total row at the beginning
    const tbody = gradingTableBody;
    const firstChild = tbody.firstChild;
    addTotalRow(existingGradings);
    if (firstChild) {
        const newTotalRow = tbody.lastChild;
        tbody.insertBefore(newTotalRow, firstChild);
    }
}

// Load existing gradings from Firestore
async function loadExistingGradings() {
    if (!currentUser) return [];
    
    try {
        // Try Firestore first
        let gradings = await firestoreData.getUserGradings(currentUser.uid);
        
        // Fallback to IndexedDB if Firestore returns empty
        if (!gradings || gradings.length === 0) {
            gradings = await indexedDBStorage.getQuestionGrades(currentUser.uid);
        }
        
        // Filter for current exam
        return gradings.filter(g => 
            g.subject === subject &&
            g.year == year &&
            g.session.toUpperCase() === sessionType.toUpperCase() &&
            g.paper == paper
        );
    } catch (error) {
        console.error('Error loading gradings:', error);
        // Try IndexedDB as final fallback
        try {
            const gradings = await indexedDBStorage.getQuestionGrades(currentUser.uid);
            return gradings.filter(g => 
                g.subject === subject &&
                g.year == year &&
                g.session.toUpperCase() === sessionType.toUpperCase() &&
                g.paper == paper
            );
        } catch (idbError) {
            console.error('Error loading from IndexedDB:', idbError);
            return [];
        }
    }
}

// Add a question row
function addQuestionRow(questionNumber, existingGradings = []) {
    const row = document.createElement('tr');
    
    const dateString = submissionData ? 
        new Date(submissionData.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 
        new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    
    // Format the full exam description
    const fullExamDescription = `${subjectTitle} - ${sessionType.toUpperCase()} ${year} Paper ${paper}`;
    
    // Check if this question has been graded
    const existingGrade = existingGradings.find(g => g.question == questionNumber);
    
    const score = existingGrade ? `${existingGrade.marks}/${existingGrade.maxMarks}` : '—';
    const grade = existingGrade ? existingGrade.grade : '—';
    const markerType = existingGrade && existingGrade.isAIReviewed ? 'AI' : 'SELF';
    const markerClass = existingGrade && existingGrade.isAIReviewed ? 'marker-badge ai' : 'marker-badge';
    const buttonClass = existingGrade ? 'btn-action active' : 'btn-action active';
    const buttonText = existingGrade ? 'OPEN' : 'REVIEW';
    
    row.innerHTML = `
        <td>${dateString}</td>
        <td class="question-cell">
            <div class="question-title">${fullExamDescription}</div>
            <div class="question-number">Q${questionNumber}</div>
        </td>
        <td>
            <span class="${markerClass}">${markerType}</span>
        </td>
        <td class="score-cell">${score}</td>
        <td class="grade-cell">${grade}</td>
        <td>
            <button class="${buttonClass}" data-question="${questionNumber}">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${buttonText}
            </button>
        </td>
    `;
    
    gradingTableBody.appendChild(row);
    
    // Add click event listener to the button
    const button = row.querySelector('.btn-action');
    button.addEventListener('click', () => {
        openQuestionGrading(questionNumber);
    });
}

// Open question grading page
function openQuestionGrading(questionNumber) {
    // Show review type selection modal
    showReviewTypeModal(questionNumber);
}

// Navigate to grading page with review type
function navigateToGrading(questionNumber, isAIReview = false) {
    const params = new URLSearchParams({
        subject: subject,
        subjectTitle: subjectTitle,
        session: sessionType,
        year: year,
        paper: paper,
        question: questionNumber,
        maxMarks: 20, // Default, can be customized per question
        isAIReview: isAIReview
    });
    
    window.location.href = `question-grading.html?${params.toString()}`;
}

// Setup event listeners
function setupEventListeners() {
    // Sign out
    signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to sign out?')) {
            await firebaseAuth.signout();
            alert('You have been signed out successfully.');
            window.location.href = '../index.html';
        }
    });
    
    // Add question row
    addRowBtn.addEventListener('click', async () => {
        questionCount++;
        saveQuestionCount(questionCount); // Save to localStorage
        const existingGradings = await loadExistingGradings();
        addQuestionRow(questionCount, existingGradings);
        // Update total row with new question count
        await updateTotalRow();
    });
    
    // Remove last row
    removeRowBtn.addEventListener('click', async () => {
        if (questionCount > 1) {
            const rows = gradingTableBody.getElementsByTagName('tr');
            if (rows.length > 1) { // Must have more than total row
                // Check if the last question has been graded
                const existingGradings = await loadExistingGradings();
                const lastQuestionGrade = existingGradings.find(g => g.question == questionCount);
                
                if (lastQuestionGrade) {
                    // Show modal and wait for user response
                    const confirmDelete = await showDeleteConfirmModal(questionCount);
                    if (!confirmDelete) return;
                    
                    // Delete the grade from Firestore and IndexedDB
                    try {
                        const gradingId = `${currentUser.uid}_${subject}_${year}_${sessionType}_P${paper}_Q${questionCount}`;
                        
                        // Delete from Firestore
                        await firestoreData.deleteQuestionGrade(currentUser.uid, subject, year, sessionType, paper, questionCount);
                        
                        // Delete from IndexedDB
                        await indexedDBStorage.deleteQuestionGrade(currentUser.uid, subject, year, sessionType, paper, questionCount);
                        
                        console.log(`Deleted grade for question ${questionCount}`);
                    } catch (error) {
                        console.error('Error deleting question grade:', error);
                        alert('Error deleting the saved grade. Please try again.');
                        return;
                    }
                }
                
                // Remove the row
                gradingTableBody.removeChild(rows[rows.length - 1]);
                questionCount--;
                saveQuestionCount(questionCount); // Save to localStorage
                
                // Update total row after removal
                await updateTotalRow();
            }
        } else {
            alert('You must have at least one question.');
        }
    });
    
    // Download attempt
    downloadAttemptBtn.addEventListener('click', () => {
        if (submissionData) {
            downloadSubmission();
        } else {
            alert('No submission found for this exam.');
        }
    });
    
    // Download memo (examiners report)
    downloadMemoBtn.addEventListener('click', () => {
        const reportLink = getExaminersReportLink(subject, sessionType, year, paper);
        
        if (reportLink) {
            // Open the examiners report in a new tab
            window.open(reportLink, '_blank');
        } else {
            alert(`Examiner's report not available for ${subjectTitle} ${sessionType} ${year} Paper ${paper}.\n\nReports may not yet be published for recent exams, or may not exist for this specific paper.`);
        }
    });
    
    // Back button
    backBtn.addEventListener('click', () => {
        // Return to progress tracker with subject auto-shown
        sessionStorage.setItem('autoShowSubject', subject);
        sessionStorage.setItem('autoShowSubjectTitle', subjectTitle);
        window.location.href = 'progress-tracker.html';
    });

    // Modal event listeners
    selfReviewBtn.addEventListener('click', () => {
        hideReviewTypeModal();
        navigateToGrading(currentQuestionNumber, false);
    });

    aiReviewBtn.addEventListener('click', () => {
        hideReviewTypeModal();
        showAiInstructionsModal();
    });

    copyPromptBtn.addEventListener('click', () => {
        // Copy the prompt to clipboard
        aiPromptText.select();
        aiPromptText.setSelectionRange(0, 99999); // For mobile devices
        
        navigator.clipboard.writeText(aiPromptText.value).then(() => {
            // Change button text temporarily
            const originalHTML = copyPromptBtn.innerHTML;
            copyPromptBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; margin-right: 8px;">
                    <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Copied!
            `;
            
            setTimeout(() => {
                copyPromptBtn.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            alert('Failed to copy prompt. Please copy manually.');
            console.error('Copy failed:', err);
        });
    });

    closeAiInstructionsBtn.addEventListener('click', () => {
        hideAiInstructionsModal();
        navigateToGrading(currentQuestionNumber, true);
    });

    // Delete confirmation modal buttons
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    
    confirmDeleteBtn.addEventListener('click', () => {
        hideDeleteConfirmModal();
        if (deleteConfirmResolve) {
            deleteConfirmResolve(true);
            deleteConfirmResolve = null;
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        hideDeleteConfirmModal();
        if (deleteConfirmResolve) {
            deleteConfirmResolve(false);
            deleteConfirmResolve = null;
        }
    });

    // Close modals when clicking outside
    reviewTypeModal.addEventListener('click', (e) => {
        if (e.target === reviewTypeModal) {
            hideReviewTypeModal();
        }
    });

    aiInstructionsModal.addEventListener('click', (e) => {
        if (e.target === aiInstructionsModal) {
            hideAiInstructionsModal();
        }
    });

    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    deleteConfirmModal.addEventListener('click', (e) => {
        if (e.target === deleteConfirmModal) {
            hideDeleteConfirmModal();
            if (deleteConfirmResolve) {
                deleteConfirmResolve(false);
                deleteConfirmResolve = null;
            }
        }
    });
}

// Download submission file
async function downloadSubmission() {
    if (!currentUser || !submissionData) {
        alert('Unable to download: No submission data found.');
        return;
    }

    // Try to get file from IndexedDB
    const result = await indexedDBStorage.downloadFile(currentUser.uid, submissionData.uploadTimestamp);
    
    if (!result.success) {
        // Show helpful message about local storage limitation
        alert(
            '📁 File Not Available on This Device\n\n' +
            'Your exam submission file is stored locally on the device where you uploaded it.\n\n' +
            '✓ Your submission metadata is synced across all devices\n' +
            '✗ The actual file can only be downloaded on the device where you uploaded it\n\n' +
            'To access this file:\n' +
            '• Go to the device where you originally uploaded it\n' +
            '• Or upload the file again on this device\n\n' +
            'This is because files are stored locally in your browser for privacy and storage efficiency.'
        );
    }
}

// Activity monitor is initialized at the top of the file
