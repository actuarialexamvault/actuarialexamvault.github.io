// Progress Tracker functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';

// Initialize activity monitor
initActivityMonitor();

const userName = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const subjectsView = document.getElementById('subjectsView');
const progressView = document.getElementById('progressView');
const subjectCards = document.querySelectorAll('.subject-card');
const backBtn = document.getElementById('backBtn');
const reviewHeader = document.getElementById('reviewHeader');
const reviewList = document.getElementById('reviewList');

// Progress elements
const subjectProgressTitle = document.getElementById('subjectProgressTitle');
const attemptedCount = document.getElementById('attemptedCount');
const totalCount = document.getElementById('totalCount');
const progressBarFill = document.getElementById('progressBarFill');
const progressPercentage = document.getElementById('progressPercentage');

// Check if user is logged in and load profile
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';

let isAuthChecked = false;

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
                    alert('Please sign in to view your progress.');
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

// Check if we should auto-show a subject (after exam upload)
const autoShowSubject = sessionStorage.getItem('autoShowSubject');
const autoShowSubjectTitle = sessionStorage.getItem('autoShowSubjectTitle');
if (autoShowSubject && autoShowSubjectTitle) {
    // Clear the session storage
    sessionStorage.removeItem('autoShowSubject');
    sessionStorage.removeItem('autoShowSubjectTitle');
    
    // Show loading and then display the subject's progress
    showLoading();
    setTimeout(() => {
        showProgressView(autoShowSubject, autoShowSubjectTitle);
        hideLoading();
    }, 500);
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
        
        // Show progress view after short delay for smooth transition
        setTimeout(() => {
            showProgressView(subject, subjectTitle);
            hideLoading();
        }, 500);
    });
});

// Handle back button
backBtn.addEventListener('click', () => {
    showSubjectsView();
});

// Toggle review section collapse
reviewHeader.addEventListener('click', () => {
    reviewHeader.classList.toggle('collapsed');
    reviewList.classList.toggle('hidden');
});

// Show subjects view
function showSubjectsView() {
    subjectsView.style.display = 'block';
    progressView.style.display = 'none';
}

// Show progress view
async function showProgressView(subject, subjectTitle) {
    subjectsView.style.display = 'none';
    progressView.style.display = 'grid';
    
    // Update title
    subjectProgressTitle.textContent = `${subjectTitle} Progress`;
    
    // Load progress data
    await loadProgressData(subject, subjectTitle);
}

// Generate all available papers for a subject (2018-2025)
function generateAllPapers(subject) {
    const papers = [];
    const years = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    const sessions = ['June', 'October'];
    
    years.forEach(year => {
        sessions.forEach(session => {
            if (subject === 'A311') {
                // A311 has Paper 1 and Paper 2 for each session
                papers.push({ 
                    year: year, 
                    session: session, 
                    paper: '1', 
                    displayYear: `${session} ${year}`,
                    displayPaper: 'Paper 1'
                });
                papers.push({ 
                    year: year, 
                    session: session, 
                    paper: '2', 
                    displayYear: `${session} ${year}`,
                    displayPaper: 'Paper 2'
                });
            } else {
                // Other subjects have only one paper per session
                papers.push({ 
                    year: year, 
                    session: session, 
                    paper: '1', 
                    displayYear: `${session} ${year}`,
                    displayPaper: 'Paper 1'
                });
            }
        });
    });
    
    return papers;
}

// Get user's exam submissions from localStorage
async function getUserSubmissions() {
    const user = firebaseAuth.getCurrentUser();
    if (!user) return [];
    
    const result = await firestoreData.getExamSubmissions(user.uid);
    if (!result.success) return [];
    
    return Object.values(result.data);
}

// Check if a paper has been attempted
function isPaperAttempted(submissions, subject, year, session, paper) {
    const found = submissions.some(sub => {
        const match = sub.subject === subject &&
            sub.year == year && // Use == to allow string/number comparison
            sub.session.toUpperCase() === session.toUpperCase() &&
            sub.paper == paper; // Use == to allow string/number comparison
        
        // Debug logging
        if (sub.subject === subject) {
            console.log('Checking:', {
                submission: sub,
                looking_for: { subject, year, session, paper },
                matches: {
                    subject: sub.subject === subject,
                    year: sub.year == year,
                    session: sub.session.toUpperCase() === session.toUpperCase(),
                    paper: sub.paper == paper
                },
                result: match
            });
        }
        
        return match;
    });
    return found;
}

// Get submission details for a paper
function getSubmissionDetails(submissions, subject, year, session, paper) {
    return submissions.find(sub => 
        sub.subject === subject &&
        sub.year == year && // Use == to allow string/number comparison
        sub.session.toUpperCase() === session.toUpperCase() &&
        sub.paper == paper // Use == to allow string/number comparison
    );
}

// Load progress data
async function loadProgressData(subject, subjectTitle) {
    const allPapers = generateAllPapers(subject);
    const submissions = await getUserSubmissions();
    
    // Calculate progress
    const totalPapers = allPapers.length;
    const attemptedPapers = allPapers.filter(paper => 
        isPaperAttempted(submissions, subject, paper.year, paper.session, paper.paper)
    ).length;
    
    const percentage = totalPapers > 0 ? Math.round((attemptedPapers / totalPapers) * 100) : 0;
    
    // Update progress UI
    attemptedCount.textContent = attemptedPapers;
    totalCount.textContent = totalPapers;
    progressBarFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}% Complete`;
    
    // Load performance statistics
    await loadPerformanceStats(subject);
    
    // Load paper list
    loadPaperList(subject, subjectTitle, allPapers, submissions);
}

// Load performance statistics
async function loadPerformanceStats(subject) {
    const user = firebaseAuth.getCurrentUser();
    if (!user) return;
    
    // Get gradings from Firestore
    const result = await firestoreData.getAllUserGradings(user.uid);
    if (!result.success) return;
    
    const gradings = Object.values(result.data);
    
    // Filter gradings for current subject
    const subjectGradings = gradings.filter(g => g.subject === subject);
    
    // Separate self-reviewed and AI-reviewed (placeholder for future AI feature)
    const selfReviewed = subjectGradings.filter(g => !g.isAIReviewed);
    const aiReviewed = subjectGradings.filter(g => g.isAIReviewed);
    
    // Calculate stats for self-reviewed
    const selfStats = calculateStats(selfReviewed);
    updateStatsDisplay('self', selfStats);
    
    // Calculate stats for AI-reviewed
    const aiStats = calculateStats(aiReviewed);
    updateStatsDisplay('ai', aiStats);
}

// Calculate statistics for a set of gradings
function calculateStats(gradings) {
    if (gradings.length === 0) {
        return {
            questionsCount: 0,
            possibleMarks: 0,
            scoredMarks: 0,
            performance: 0
        };
    }
    
    const questionsCount = gradings.length;
    const possibleMarks = gradings.reduce((sum, g) => sum + (g.maxMarks || 0), 0);
    const scoredMarks = gradings.reduce((sum, g) => sum + (g.marks || 0), 0);
    const performance = possibleMarks > 0 ? Math.round((scoredMarks / possibleMarks) * 100) : 0;
    
    return {
        questionsCount,
        possibleMarks,
        scoredMarks: scoredMarks.toFixed(1),
        performance
    };
}

// Update stats display in the table
function updateStatsDisplay(type, stats) {
    document.getElementById(`${type}QuestionsCount`).textContent = stats.questionsCount;
    document.getElementById(`${type}PossibleMarks`).textContent = stats.possibleMarks;
    document.getElementById(`${type}ScoredMarks`).textContent = stats.scoredMarks;
    document.getElementById(`${type}Performance`).textContent = `${stats.performance}%`;
}

// Load paper list
function loadPaperList(subject, subjectTitle, allPapers, submissions) {
    reviewList.innerHTML = '';
    
    if (allPapers.length === 0) {
        reviewList.innerHTML = '<p style="color: #666; padding: 1rem;">No papers available</p>';
        return;
    }
    
    allPapers.forEach(paper => {
        const isAttempted = isPaperAttempted(submissions, subject, paper.year, paper.session, paper.paper);
        const submissionDetails = isAttempted ? getSubmissionDetails(submissions, subject, paper.year, paper.session, paper.paper) : null;
        
        const paperItem = createPaperItem(paper, subjectTitle, isAttempted, submissionDetails);
        reviewList.appendChild(paperItem);
    });
}

// Create paper item element
function createPaperItem(paper, subjectTitle, isAttempted, submissionDetails) {
    const div = document.createElement('div');
    div.className = 'paper-item';
    
    // Format timestamp if available
    let timestampHTML = '';
    if (isAttempted && submissionDetails && submissionDetails.timestamp) {
        const date = new Date(submissionDetails.timestamp);
        const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        timestampHTML = `<div class="paper-timestamp">Completed: ${formattedDate}</div>`;
    }
    
    div.innerHTML = `
        <div class="paper-item-left">
            <div class="paper-badge ${isAttempted ? 'attempted' : 'not-attempted'}">
                <div>${paper.displayYear}</div>
                <div style="font-size: 0.75rem; margin-top: 0.25rem;">${paper.displayPaper}</div>
            </div>
            <div class="paper-info">
                <div class="paper-title">${subjectTitle} - ${paper.displayYear} ${paper.displayPaper}</div>
                ${timestampHTML}
            </div>
        </div>
        <div class="paper-action">
            <span class="action-label ${isAttempted ? 'completed' : 'new'}">${isAttempted ? 'REVIEW' : 'START'}</span>
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `;
    
    div.addEventListener('click', () => {
        handlePaperClick(paper, subjectTitle, isAttempted);
    });
    
    return div;
}

// Handle paper click
function handlePaperClick(paper, subjectTitle, isAttempted) {
    // Get the actual subject code (extract from subjectTitle)
    const subjectMatch = subjectTitle.match(/^([A-Z]\d+)/);
    const subjectCode = subjectMatch ? subjectMatch[1] : 'A311';
    
    if (isAttempted) {
        // Navigate to exam review page for completed exams
        const params = new URLSearchParams({
            subject: subjectCode,
            subjectTitle: subjectTitle,
            session: paper.session.toUpperCase(),
            year: paper.year,
            paper: paper.paper
        });
        
        window.location.href = `exam-review.html?${params.toString()}`;
    } else {
        // Navigate to exam instructions page for new attempts
        const params = new URLSearchParams({
            subject: subjectCode,
            subjectTitle: subjectTitle,
            session: paper.session.toUpperCase(),
            year: paper.year,
            paper: paper.paper,
            from: 'progress' // Indicate this came from progress tracker
        });
        
        window.location.href = `exam-instructions.html?${params.toString()}`;
    }
}

// Show loading overlay
function showLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
}

// Hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// Add click handlers for sidebar sections
document.querySelectorAll('.sidebar-section').forEach((section, index) => {
    section.addEventListener('click', () => {
        const features = ['Do Questions', 'Question Bank', 'Intelligence'];
        alert(`${features[index]} feature coming soon!\n\nThis will provide additional ways to practice and study.`);
    });
});

// Firebase handles session management automatically - no need for manual extension
