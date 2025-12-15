// Progress Tracker functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { hasPDFLink } from './pdf-links.js';
import { indexedDBStorage } from './indexeddb-storage.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

const userName = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const subjectsView = document.getElementById('subjectsView');
const progressView = document.getElementById('progressView');
const subjectCards = document.querySelectorAll('.subject-card');
const backBtn = document.getElementById('backBtn');
const attemptedHeader = document.getElementById('attemptedHeader');
const attemptedList = document.getElementById('attemptedList');
const notAttemptedHeader = document.getElementById('notAttemptedHeader');
const notAttemptedList = document.getElementById('notAttemptedList');

// Progress elements
const subjectProgressTitle = document.getElementById('subjectProgressTitle');
const attemptedCount = document.getElementById('attemptedCount');
const totalCount = document.getElementById('totalCount');
const attemptedPapersCount = document.getElementById('attemptedPapersCount');
const notAttemptedPapersCount = document.getElementById('notAttemptedPapersCount');
const performanceLineGraph = document.getElementById('performanceLineGraph');

// Chart.js instance
let lineChartInstance = null;

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

// Toggle sections collapse
attemptedHeader.addEventListener('click', () => {
    attemptedHeader.classList.toggle('collapsed');
    attemptedList.classList.toggle('hidden');
});

notAttemptedHeader.addEventListener('click', () => {
    notAttemptedHeader.classList.toggle('collapsed');
    notAttemptedList.classList.toggle('hidden');
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
    
    // Save as last accessed subject for "Continue Where You Left Off"
    sessionStorage.setItem('selectedSubject', subject);
    sessionStorage.setItem('selectedSubjectTitle', subjectTitle);
    
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
            if (subject === 'A311' || subject === 'A211') {
                // A311 and A211 have Paper 1 and Paper 2 for each session
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
    
    // Filter to only include papers with available PDFs
    const availablePapers = allPapers.filter(paper => 
        hasPDFLink(subject, paper.session, paper.year, paper.paper)
    );
    
    // Calculate progress (only count available PDFs)
    const totalPapers = availablePapers.length;
    const attemptedPapers = availablePapers.filter(paper => 
        isPaperAttempted(submissions, subject, paper.year, paper.session, paper.paper)
    ).length;
    
    // Update progress UI
    attemptedCount.textContent = attemptedPapers;
    totalCount.textContent = totalPapers;
    
    // Load performance statistics and graph, get gradings for paper lists
    const gradings = await loadPerformanceStats(subject, allPapers, submissions);
    
    // Load separate paper lists with gradings
    loadPaperLists(subject, subjectTitle, allPapers, submissions, gradings);
}

// Load performance statistics and create line graph
async function loadPerformanceStats(subject, allPapers, submissions) {
    const user = firebaseAuth.getCurrentUser();
    if (!user) return null;
    
    try {
        // Get gradings from Firestore (includes standalone question grades)
        let gradings = await firestoreData.getUserGradings(user.uid);
        
        // Fallback to IndexedDB if Firestore returns empty
        if (!gradings || gradings.length === 0) {
            gradings = await indexedDBStorage.getQuestionGrades(user.uid);
        }
        
        // Filter gradings for current subject
        const subjectGradings = gradings.filter(g => g.subject === subject);
        
        // Separate self-reviewed and AI-reviewed
        const selfReviewed = subjectGradings.filter(g => !g.isAIReviewed);
        const aiReviewed = subjectGradings.filter(g => g.isAIReviewed);
        
        // Calculate stats for self-reviewed
        const selfStats = calculateStats(selfReviewed);
        updateStatsDisplay('self', selfStats);
        
        // Calculate stats for AI-reviewed
        const aiStats = calculateStats(aiReviewed);
        updateStatsDisplay('ai', aiStats);
        
        // Create performance line graph
        createPerformanceLineGraph(subject, allPapers, submissions, gradings);
        
        // Return gradings for use in paper lists
        return gradings;
    } catch (error) {
        console.error('Error loading performance stats:', error);
        // Show zero stats on error
        updateStatsDisplay('self', { questionsCount: 0, possibleMarks: 0, scoredMarks: '0', performance: 0 });
        updateStatsDisplay('ai', { questionsCount: 0, possibleMarks: 0, scoredMarks: '0', performance: 0 });
        return [];
    }
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

// Create performance line graph
function createPerformanceLineGraph(subject, allPapers, submissions, gradings) {
    // Get the performance graph section element
    const performanceGraphSection = document.querySelector('.performance-graph-section');
    
    // Destroy existing chart if it exists
    if (lineChartInstance) {
        lineChartInstance.destroy();
        lineChartInstance = null;
    }
    
    // Filter for attempted papers and calculate performance for each
    const paperPerformances = [];
    
    allPapers.forEach(paper => {
        const isAttempted = isPaperAttempted(submissions, subject, paper.year, paper.session, paper.paper);
        if (!isAttempted) return;
        
        // Get submission details to retrieve completion timestamp
        const submissionDetails = getSubmissionDetails(submissions, subject, paper.year, paper.session, paper.paper);
        
        // Get gradings for this specific paper
        const paperGradings = gradings.filter(g => 
            g.subject === subject && 
            g.year === paper.year && 
            g.session.toLowerCase() === paper.session.toLowerCase() && 
            g.paper === paper.paper
        );
        
        if (paperGradings.length > 0) {
            const totalMarks = paperGradings.reduce((sum, g) => sum + (g.marks || 0), 0);
            const totalMaxMarks = paperGradings.reduce((sum, g) => sum + (g.maxMarks || 0), 0);
            const percentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
            
            paperPerformances.push({
                label: `${paper.displayYear} ${paper.displayPaper}`,
                performance: percentage,
                year: paper.year,
                session: paper.session,
                paper: paper.paper,
                timestamp: submissionDetails ? submissionDetails.timestamp : null
            });
        }
    });
    
    // Sort by completion date (timestamp) - earliest to latest
    paperPerformances.sort((a, b) => {
        // If either timestamp is missing, use paper chronology as fallback
        if (!a.timestamp && !b.timestamp) {
            if (a.year !== b.year) return a.year - b.year;
            const sessionOrder = { 'june': 1, 'october': 2, 'november': 2 };
            const sessionA = sessionOrder[a.session.toLowerCase()] || 0;
            const sessionB = sessionOrder[b.session.toLowerCase()] || 0;
            return sessionA - sessionB;
        }
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        
        // Sort by timestamp
        return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // If no data, hide the entire graph section
    if (paperPerformances.length === 0) {
        if (performanceGraphSection) {
            performanceGraphSection.style.display = 'none';
        }
        return;
    }
    
    // Show the graph section if it was hidden
    if (performanceGraphSection) {
        performanceGraphSection.style.display = 'block';
    }
    
    // Extract labels and data
    const labels = paperPerformances.map(p => p.label);
    const data = paperPerformances.map(p => p.performance);
    
    // Calculate dynamic y-axis range
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const range = maxValue - minValue;
    const padding = Math.max(5, range * 0.5); // 5% padding or minimum 10 points
    const yMin = Math.max(0, Math.floor(minValue - padding));
    const yMax = Math.min(100, Math.ceil(maxValue + padding));
    
    // Create the chart
    const ctx = performanceLineGraph.getContext('2d');
    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.3,
                fill: false,
                pointRadius: 20,
                pointHoverRadius: 22,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: 'white',
                pointBorderWidth: 3,
                datalabels: {
                    display: true,
                    align: 'center',
                    anchor: 'center',
                    formatter: (value) => `${value}%`,
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 11
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 20,
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                },
                datalabels: {
                    display: true,
                    align: 'center',
                    anchor: 'center',
                    offset: 0,
                    formatter: (value) => `${value}%`,
                    color: '#ffffff',
                    font: {
                        weight: 'bold',
                        size: 12
                    }
                }
            },
            scales: {
                y: {
                    display: false,
                    min: yMin,
                    max: yMax
                },
                x: {
                    offset: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#666',
                        font: {
                            size: 11
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Load separate paper lists for attempted and not attempted
function loadPaperLists(subject, subjectTitle, allPapers, submissions, gradings = []) {
    // Clear both lists
    attemptedList.innerHTML = '';
    notAttemptedList.innerHTML = '';
    
    if (allPapers.length === 0) {
        notAttemptedList.innerHTML = '<p class="empty-state-message">No papers available</p>';
        return;
    }
    
    // Separate papers into attempted and not attempted
    const attemptedPapers = [];
    const notAttemptedPapers = [];
    
    allPapers.forEach(paper => {
        const isAttempted = isPaperAttempted(submissions, subject, paper.year, paper.session, paper.paper);
        if (isAttempted) {
            attemptedPapers.push(paper);
        } else {
            notAttemptedPapers.push(paper);
        }
    });
    
    // Update section counts
    attemptedPapersCount.textContent = attemptedPapers.length;
    notAttemptedPapersCount.textContent = notAttemptedPapers.length;
    
    // Load attempted papers
    if (attemptedPapers.length === 0) {
        attemptedList.innerHTML = '<p class="empty-state-message">No papers attempted yet</p>';
    } else {
        attemptedPapers.forEach(paper => {
            const submissionDetails = getSubmissionDetails(submissions, subject, paper.year, paper.session, paper.paper);
            // Add gradings to submission details for score calculation
            if (submissionDetails) {
                submissionDetails.gradings = gradings;
            }
            const paperItem = createPaperItem(paper, subject, subjectTitle, true, submissionDetails);
            attemptedList.appendChild(paperItem);
        });
    }
    
    // Sort not attempted papers: PDFs available first, then unavailable
    notAttemptedPapers.sort((a, b) => {
        const aHasPDF = hasPDFLink(subject, a.session, a.year, a.paper);
        const bHasPDF = hasPDFLink(subject, b.session, b.year, b.paper);
        
        // Papers with PDFs come first (return -1 if a has PDF and b doesn't)
        if (aHasPDF && !bHasPDF) return -1;
        if (!aHasPDF && bHasPDF) return 1;
        
        // If both have same PDF status, maintain original order (by year, then session)
        return 0;
    });
    
    // Load not attempted papers
    if (notAttemptedPapers.length === 0) {
        notAttemptedList.innerHTML = '<p class="empty-state-message">All papers have been attempted!</p>';
    } else {
        notAttemptedPapers.forEach(paper => {
            const paperItem = createPaperItem(paper, subject, subjectTitle, false, null);
            notAttemptedList.appendChild(paperItem);
        });
    }
}

// Create paper item element
function createPaperItem(paper, subject, subjectTitle, isAttempted, submissionDetails) {
    const div = document.createElement('div');
    div.className = 'paper-item';
    
    // Calculate overall score for attempted papers
    let scoreHTML = '';
    if (isAttempted && submissionDetails && submissionDetails.gradings) {
        const paperGradings = submissionDetails.gradings.filter(g => 
            g.subject === subject && 
            g.year === paper.year && 
            g.session.toLowerCase() === paper.session.toLowerCase() && 
            g.paper === paper.paper
        );
        
        if (paperGradings.length > 0) {
            const totalMarks = paperGradings.reduce((sum, g) => sum + (g.marks || 0), 0);
            const totalMaxMarks = paperGradings.reduce((sum, g) => sum + (g.maxMarks || 0), 0);
            const percentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
            
            let scoreClass = 'score-low';
            if (percentage >= 60) scoreClass = 'score-high';
            else if (percentage >= 40) scoreClass = 'score-medium';
            
            scoreHTML = `<div class="paper-score-badge ${scoreClass}">Grade: ${percentage}%</div>`;
        } else {
            // Paper attempted but not graded yet
            scoreHTML = `<div class="paper-score-badge not-graded">Not graded</div>`;
        }
    } else if (isAttempted) {
        // Paper attempted but no grading data available
        scoreHTML = `<div class="paper-score-badge not-graded">Not graded</div>`;
    }
    
    // Check PDF availability for not attempted papers
    let pdfBannerHTML = '';
    let badgeClass = 'attempted';
    
    if (!isAttempted) {
        const hasPDF = hasPDFLink(subject, paper.session, paper.year, paper.paper);
        pdfBannerHTML = `
            <div class="pdf-availability-banner ${hasPDF ? 'pdf-available' : 'pdf-unavailable'}"></div>
        `;
        // Set badge class based on PDF availability
        badgeClass = hasPDF ? 'available' : 'not-attempted';
    }
    
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
        ${pdfBannerHTML}
        <div class="paper-item-content">
            <div class="paper-item-left">
                <div class="paper-badge ${badgeClass}">
                    <div>${paper.displayYear}</div>
                    <div style="font-size: 0.75rem; margin-top: 0.25rem;">${paper.displayPaper}</div>
                </div>
                <div class="paper-info">
                    <div class="paper-title">${subjectTitle} - ${paper.displayYear} ${paper.displayPaper}</div>
                    ${timestampHTML}
                    ${scoreHTML}
                </div>
            </div>
            <div class="paper-action">
                <span class="action-label ${isAttempted ? 'completed' : 'new'}">${isAttempted ? 'REVIEW' : 'START'}</span>
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
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
