// Exam Review functionality
const authManager = new AuthManager();

// Check authentication
const session = authManager.getSession();
if (!session) {
    alert('Please sign in to access exam reviews.');
    window.location.href = 'signin.html';
}

// Modal management
let currentQuestionNumber = null;

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

document.addEventListener('DOMContentLoaded', function() {
    loadExamDetails();
    initializeTable();
    setupEventListeners();
});

// Load exam details
function loadExamDetails() {
    // Update title
    reviewTitle.textContent = `${subjectTitle} - ${sessionType} ${year} Paper ${paper}`;
    reviewSubtitle.textContent = 'Review your exam attempt and grade your answers';
    
    // Get submission data
    submissionData = getSubmissionData();
    
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

// Get submission data from localStorage
function getSubmissionData() {
    const submissionsKey = `examSubmissions_${session.email}`;
    const submissions = JSON.parse(localStorage.getItem(submissionsKey) || '[]');
    
    return submissions.find(sub => 
        sub.subject === subject &&
        sub.year == year &&
        sub.session.toUpperCase() === sessionType.toUpperCase() &&
        sub.paper == paper
    );
}

// Initialize table with default 8 questions
function initializeTable() {
    gradingTableBody.innerHTML = '';
    
    // Load existing gradings
    const existingGradings = loadExistingGradings();
    
    for (let i = 1; i <= questionCount; i++) {
        addQuestionRow(i, existingGradings);
    }
}

// Load existing gradings from localStorage
function loadExistingGradings() {
    const gradingKey = `questionGradings_${session.email}`;
    const gradings = JSON.parse(localStorage.getItem(gradingKey) || '[]');
    
    return gradings.filter(g => 
        g.subject === subject &&
        g.year == year &&
        g.session.toUpperCase() === sessionType.toUpperCase() &&
        g.paper == paper
    );
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
    signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to sign out?')) {
            authManager.signOut();
            alert('You have been signed out successfully.');
            window.location.href = '../index.html';
        }
    });
    
    // Add question row
    addRowBtn.addEventListener('click', () => {
        questionCount++;
        const existingGradings = loadExistingGradings();
        addQuestionRow(questionCount, existingGradings);
    });
    
    // Remove last row
    removeRowBtn.addEventListener('click', () => {
        if (questionCount > 1) {
            const rows = gradingTableBody.getElementsByTagName('tr');
            if (rows.length > 0) {
                gradingTableBody.removeChild(rows[rows.length - 1]);
                questionCount--;
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
    
    // Download memo
    downloadMemoBtn.addEventListener('click', () => {
        alert('Memo download functionality coming soon!\n\nThis will allow you to download the official marking memorandum for this exam.');
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
}

// Download submission file
function downloadSubmission() {
    // Get the stored file data
    const fileDataKey = `submission_${submissionData.uploadTimestamp}`;
    const fileDataStr = localStorage.getItem(fileDataKey);
    
    if (fileDataStr) {
        try {
            const fileData = JSON.parse(fileDataStr);
            
            // Create download link
            const link = document.createElement('a');
            link.href = fileData.data;
            link.download = fileData.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Error downloading file. The file data may be corrupted.');
        }
    } else {
        alert('File data not found. The submission may have been cleared from local storage.');
    }
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
