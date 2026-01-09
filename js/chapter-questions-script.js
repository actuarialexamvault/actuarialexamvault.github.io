import { themeManager } from './theme-manager.js';
import { attachSignOutHandler } from './signout-modal.js';
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';

// Utility function to format question filename to readable name
function formatQuestionName(filename) {
    // Remove path and .md extension
    const basename = filename.split(/[\\/]/).pop().replace(/\.md$/, '');
    
    // Parse the filename: F102_JUNE_2012_Paper1_Q7
    const parts = basename.match(/^([A-Z]\d+)_([A-Z]+)_(\d{4})_Paper(\d+)_Q(\d+)$/i);
    
    if (parts) {
        const [, subject, session, year, paper, question] = parts;
        // Capitalize session (JUNE -> June, NOVEMBER -> November)
        const sessionFormatted = session.charAt(0) + session.slice(1).toLowerCase();
        return `${subject} ${sessionFormatted} ${year} Paper ${paper} Question ${question}`;
    }
    
    // Fallback: just return the basename with underscores replaced by spaces
    return basename.replace(/_/g, ' ');
}

// Modal state
let currentSelectedQuestion = null;

// Modal functions
function showReviewTypeModal(question) {
    currentSelectedQuestion = question;
    const modal = document.getElementById('reviewTypeModal');
    modal.style.display = 'flex';
}

function hideReviewTypeModal() {
    const modal = document.getElementById('reviewTypeModal');
    modal.style.display = 'none';
}

async function showAiInstructionsModal(question) {
    const modal = document.getElementById('aiInstructionsModal');
    const promptText = document.getElementById('aiPromptText');
    
    // Build comprehensive prompt
    const basePrompt = `You are a strict Actuarial board exam marker. You are known for producing the best Actuaries, known for their competence, strong professional and analytical skills hence you look for the clear demonstration of these factors when marking exam questions. When you mark a question you do not assign marks leniently, you stick to what was asked vs what is expected. You expect students to know and apply the core concepts that are being tested to demonstrate the competency that is expected of an Actuary.

The Final Grade & score depends on the number of points that the student articulated against what is in the memo.
Mark allocation: One valid point is equivalent to a 0.5 mark. That is, if a question has 2 marks available then the student should give 4 valid and distinct points. If the point is not directly mentioned in the memo use the spirit of the memo wording to award marks if what the student said is in line with what is expected.

Your summary feedback to the student should include the annotated answer marked against the examiners report/feedback and a brief feedback summary focusing on identifying weak areas and topics that require further study.

---

`;
    
    try {
        // Load question text
        promptText.value = basePrompt + "Loading question, solution, and your answer...";
        
        const questionText = await loadQuestionText(question);
        const solutionText = await loadSolutionText(question);
        const userAnswer = await loadUserAnswer(question);
        
        const fullPrompt = basePrompt +
            `QUESTION:\n${questionText}\n\n` +
            `EXAMINER'S SOLUTION/MEMO:\n${solutionText}\n\n` +
            `STUDENT'S ANSWER:\n${userAnswer}\n\n` +
            `Please provide your detailed feedback and grading for this answer.`;
        
        promptText.value = fullPrompt;
    } catch (error) {
        console.error('Error building AI prompt:', error);
        promptText.value = basePrompt + "\n\n[Error loading question details. Please review manually.]";
    }
    
    modal.style.display = 'flex';
}

function hideAiInstructionsModal() {
    console.log('hideAiInstructionsModal called');
    const modal = document.getElementById('aiInstructionsModal');
    modal.style.display = 'none';
    
    // Ensure reviewType is set to 'ai' and question data is in sessionStorage
    sessionStorage.setItem('reviewType', 'ai');
    console.log('Set reviewType to ai');
    
    // Verify question is stored (should already be there from click handler)
    if (currentSelectedQuestion) {
        sessionStorage.setItem('selectedQuestion', JSON.stringify(currentSelectedQuestion));
        console.log('Stored selected question:', currentSelectedQuestion);
    } else {
        console.warn('No currentSelectedQuestion available!');
    }
    
    // Navigate to grading page for AI review
    console.log('Navigating to chapter-question-grading.html');
    window.location.href = `chapter-question-grading.html`;
}

// Helper functions to load question/solution/answer text
async function loadQuestionText(question) {
    try {
        const outRaw = question.output || '';
        let outNorm = outRaw.replace(/\\/g, '/');
        if (outNorm && !outNorm.startsWith('/') && !outNorm.startsWith('../') && !outNorm.startsWith('./')) {
            outNorm = `../${outNorm}`;
        }
        const response = await fetch(outNorm);
        if (!response.ok) throw new Error('Failed to load question');
        return await response.text();
    } catch (error) {
        console.error('Error loading question:', error);
        return '[Question text could not be loaded]';
    }
}

async function loadSolutionText(question) {
    try {
        // Parse question path to build solution path
        const questionPath = question.output || '';
        const normalizedPath = questionPath.replace(/\\/g, '/');
        const pathParts = normalizedPath.split('/');
        
        const questionsIndex = pathParts.indexOf('questions');
        if (questionsIndex === -1) return '[Solution not available]';
        
        const subject = pathParts[questionsIndex + 1];
        const session = pathParts[questionsIndex + 2];
        const year = pathParts[questionsIndex + 3];
        const paper = pathParts[questionsIndex + 4];
        
        const filename = pathParts[pathParts.length - 1];
        const qMatch = filename.match(/_Q(\d+)\.md$/);
        const questionNum = qMatch ? qMatch[1] : '1';
        
        const solutionPaths = [
            `../resources/markdown_questions/solutions/${subject}/${year}/${session}/${paper}/${subject}_${session}_${year}_${paper}_Q${questionNum}.md`,
            `../resources/markdown_questions/solutions/${subject}/${year}/${session}/Papergeneral/${subject}_${session}_${year}_Papergeneral_Q${questionNum}.md`
        ];
        
        let response = await fetch(solutionPaths[0]);
        if (!response.ok) {
            response = await fetch(solutionPaths[1]);
            if (!response.ok) throw new Error('Solution not found');
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error loading solution:', error);
        return '[Solution not available]';
    }
}

async function loadUserAnswer(question) {
    try {
        const user = firebaseAuth.getCurrentUser();
        if (!user) return '[No user answer recorded]';
        
        // Get basename from question output path (same as question-editor.js)
        const outRaw = question.output || '';
        const basename = outRaw.split(/[\\/]/).pop() || outRaw;
        
        // Create draft key same as question-editor.js
        const draftKey = `draft_${basename}`;
        
        // Try to load from localStorage (where question-editor.js saves)
        const savedAnswer = localStorage.getItem(draftKey);
        
        if (savedAnswer) {
            return savedAnswer;
        }
        
        return '[No answer recorded yet - please attempt the question first]';
    } catch (error) {
        console.error('Error loading user answer:', error);
        return '[Could not load your answer]';
    }
}

themeManager.init();
attachSignOutHandler('#signOutBtn');

const container = document.getElementById('questionsContainer');
const params = new URLSearchParams(window.location.search);
const subject = params.get('subject') || sessionStorage.getItem('selectedSubject');
const chapter = params.get('chapter') || sessionStorage.getItem('practice_chapter');

const attemptedList = document.getElementById('attemptedList');
const notAttemptedList = document.getElementById('notAttemptedList');
const attemptedCountEl = document.getElementById('attemptedQuestionsCount');
const notAttemptedCountEl = document.getElementById('notAttemptedQuestionsCount');
const subjectChapterTitle = document.getElementById('subjectChapterTitle');
const backBtn = document.getElementById('backBtn');
const performanceGraphSection = document.getElementById('performanceGraphSection');
const performanceLineGraph = document.getElementById('performanceLineGraph');

// Chart.js instance
let lineChartInstance = null;

backBtn.addEventListener('click', () => {
    const subjectTitle = sessionStorage.getItem('selectedSubjectTitle') || subject;
    if (subject && subjectTitle) {
        window.location.href = `practice-by-chapter.html?subject=${encodeURIComponent(subject)}&subjectTitle=${encodeURIComponent(subjectTitle)}`;
    } else if (subject) {
        window.location.href = `practice-by-chapter.html?subject=${encodeURIComponent(subject)}`;
    } else {
        window.history.back();
    }
});

// Function to load and display questions
async function loadChapterQuestions() {
    if (!subject || !chapter) {
        container.innerHTML = '<p style="color:#666; padding:1rem;">No subject or chapter selected.</p>';
        return;
    }
    
    // Set page title to only show the chapter name
    const chap = (chapter || '').trim();
    const title = chap || '';
    document.getElementById('pageTitle').textContent = title;
    subjectChapterTitle.textContent = title;
    const topHeader = document.querySelector('.subjects-header');
    if (topHeader) topHeader.style.display = 'none';
    
    try {
        const [manifest, unavailable] = await Promise.all([
            loadManifest(subject),
            loadUnavailablePapers()
        ]);
        const questions = manifest.filter(item => (item.chapters||[]).includes(chapter));
        const filtered = filterAvailableQuestions(questions, unavailable, subject);
        await loadAndRenderQuestions(filtered.available, filtered.unavailableCount);
    } catch (err) {
        console.error('Failed to load manifest for subject', subject, err);
        container.innerHTML = '<p style="color:#666; padding:1rem;">Failed to load questions for this chapter.</p>';
    }
}

// Initial load
loadChapterQuestions();

// Reload questions when page becomes visible (user returns from grading page)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && subject && chapter) {
        console.log('Page visible again - refreshing question lists');
        loadChapterQuestions();
    }
});

// Also reload on page focus (backup mechanism)
window.addEventListener('focus', () => {
    if (subject && chapter) {
        console.log('Page focused - refreshing question lists');
        loadChapterQuestions();
    }
});

async function loadManifest(subject) {
    const url = `../resources/markdown_questions/questions/${subject}/manifest_questions.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function loadUnavailablePapers() {
    try {
        const url = '../resources/markdown_questions/unavailable_papers.json';
        const res = await fetch(url);
        if (!res.ok) return {};
        return res.json();
    } catch (e) {
        console.warn('Could not load unavailable papers list', e);
        return {};
    }
}

function filterAvailableQuestions(questions, unavailableData, subject) {
    const unavailableList = unavailableData[subject]?.scanned_pdfs_requiring_ocr || [];
    const questionsWithAvailability = [];
    let unavailableCount = 0;
    
    for (const q of questions) {
        // Extract year, session, paper from output path
        // Path format: resources/markdown_questions/questions/F102/SESSION/YEAR/PaperX/questions/...
        const pathParts = (q.output || '').split(/[\/\\]/);
        const sessionIdx = pathParts.findIndex(p => p === subject) + 1;
        const session = pathParts[sessionIdx];
        const year = pathParts[sessionIdx + 1];
        const paperPart = pathParts[sessionIdx + 2]; // e.g., "Paper1"
        const paper = paperPart ? paperPart.replace(/^Paper/, '') : null;
        
        // Check if this paper is in the unavailable list
        const isUnavailable = unavailableList.some(u => 
            u.session === session && 
            u.year === year && 
            u.paper === paper
        );
        
        // Mark question with availability status
        questionsWithAvailability.push({
            ...q,
            _isUnavailable: isUnavailable
        });
        
        if (isUnavailable) {
            unavailableCount++;
        }
    }
    
    return { available: questionsWithAvailability, unavailableCount };
}

async function loadAndRenderQuestions(questions, unavailableCount) {
    // Load user gradings (try Firestore then IndexedDB)
    let gradings = [];
    const user = firebaseAuth.getCurrentUser();
    try {
        if (user) {
            const res = await firestoreData.getUserGradings(user.uid);
            if (res && res.length) gradings = res;
        }
    } catch (e) {
        console.warn('Firestore gradings fetch failed, will try IndexedDB', e);
    }
    if (!gradings || gradings.length === 0) {
        try {
            const idb = await indexedDBStorage.getQuestionGrades(user ? user.uid : null);
            if (idb && idb.length) gradings = idb;
        } catch (e) {
            console.warn('IndexedDB gradings fetch failed', e);
        }
    }

    // Partition questions into attempted vs available by matching gradings
    const attempted = [];
    const available = [];
    const unavailable = [];

    for (const q of questions) {
        // Check if question is marked as unavailable
        if (q._isUnavailable) {
            unavailable.push(q);
            continue;
        }
        
        // Parse metadata from output path since manifest doesn't have separate fields
        // Path format: resources/markdown_questions/questions/F102/JUNE/2012/Paper1/questions/F102_JUNE_2012_Paper1_Q1.md
        const basename = (q.output || '').split(/[\\/]/).pop() || '';
        const pathMatch = basename.match(/([^_]+)_([^_]+)_(\d{4})_Paper(\d+)_Q(\d+)\.md$/i);
        
        if (!pathMatch) {
            available.push(q);
            continue;
        }
        
        const [, qSubject, qSession, qYear, qPaper, qQuestion] = pathMatch;
        const qNum = qQuestion.toString().replace(/^q/i, '');
        
        // Match against gradings
        const matched = gradings.find(g => {
            if (!g.subject || !g.year || !g.session || !g.paper || !g.question) return false;
            if (g.subject.toUpperCase() !== qSubject.toUpperCase()) return false;
            if (g.year.toString() !== qYear) return false;
            if (g.session.toLowerCase().slice(0, 3) !== qSession.toLowerCase().slice(0, 3)) return false;
            if (g.paper.toString() !== qPaper) return false;
            if (g.question.toString().replace(/^q/i, '') !== qNum) return false;
            return true;
        });

        if (matched) attempted.push({ q, grade: matched });
        else available.push(q);
    }

    renderQuestionSections(attempted, available, unavailable, unavailableCount);
    
    // Update chapter statistics counts
    const chapterAttemptedCountEl = document.getElementById('chapterAttemptedCount');
    const chapterTotalCountEl = document.getElementById('chapterTotalCount');
    if (chapterAttemptedCountEl) chapterAttemptedCountEl.textContent = attempted.length;
    if (chapterTotalCountEl) chapterTotalCountEl.textContent = available.length + attempted.length;
    
    // Update performance statistics table
    updatePerformanceStats(gradings, subject, chapter);
    
    // Create performance chart if there are attempted questions with gradings
    if (attempted.length > 0) {
        createPerformanceChart(attempted, chapter);
    } else {
        // Hide chart if no attempts
        if (performanceGraphSection) performanceGraphSection.style.display = 'none';
    }
}

// Create performance line chart for chapter
function createPerformanceChart(attemptedQuestions, chapter) {
    // Destroy existing chart if it exists
    if (lineChartInstance) {
        lineChartInstance.destroy();
        lineChartInstance = null;
    }
    
    // Extract gradings from attempted questions and sort by timestamp
    const chapterGradings = attemptedQuestions
        .map(a => a.grade)
        .filter(g => g && g.timestamp && g.marks !== undefined && g.maxMarks !== undefined)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (chapterGradings.length === 0) {
        if (performanceGraphSection) {
            performanceGraphSection.style.display = 'none';
        }
        return;
    }
    
    // Show the graph section
    if (performanceGraphSection) {
        performanceGraphSection.style.display = 'block';
    }
    
    // Build labels and data
    const labels = [];
    const data = [];
    
    chapterGradings.forEach((g, index) => {
        // Create label with question identifier and original session/year
        const questionLabel = g.question ? `Q${g.question}` : `Attempt ${index + 1}`;
        
        // Format session and year from grading data
        let sessionYear = '';
        if (g.session && g.year) {
            const sessionShort = g.session.slice(0, 3); // JUN or NOV
            const sessionFormatted = sessionShort.charAt(0) + sessionShort.slice(1).toLowerCase(); // Jun or Nov
            sessionYear = `${sessionFormatted} ${g.year}`;
        } else if (g.year) {
            sessionYear = g.year.toString();
        } else {
            // Fallback to attempt date if no session/year
            sessionYear = new Date(g.timestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        
        labels.push(`${questionLabel}\n${sessionYear}`);
        
        // Calculate percentage
        const percentage = (g.marks / g.maxMarks) * 100;
        data.push(Math.round(percentage));
    });
    
    // Calculate dynamic viewport range around the data
    // Data is still plotted on 0-100 scale, but we only show the relevant portion
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const padding = 15; // Add ±2% padding around the data
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

// Update performance statistics table for the chapter
function updatePerformanceStats(grades, subject, chapter) {
    const performanceStatsSection = document.getElementById('performanceStatsSection');
    
    console.log('updatePerformanceStats - Total grades:', grades.length);
    console.log('updatePerformanceStats - Subject:', subject);
    
    // Filter grades for this subject (ALL questions from practice-by-chapter AND exam-review)
    const subjectGrades = grades.filter(g => {
        if (!g.subject || g.subject.toUpperCase() !== subject.toUpperCase()) return false;
        if (!g.timestamp || g.marks === undefined || g.maxMarks === undefined) return false;
        return true;
    });
    
    console.log('updatePerformanceStats - Subject grades:', subjectGrades.length);
    console.log('updatePerformanceStats - Sample grades:', subjectGrades.slice(0, 3));
    
    if (subjectGrades.length === 0) {
        performanceStatsSection.style.display = 'none';
        return;
    }
    
    // Show the stats section
    performanceStatsSection.style.display = 'block';
    
    // Split by review type - handle both new reviewType field and old isAIReviewed field
    const selfReviewed = subjectGrades.filter(g => {
        // New format: reviewType === 'self'
        if (g.reviewType === 'self') return true;
        // Old format: isAIReviewed === false or undefined
        if (g.reviewType === undefined && !g.isAIReviewed) return true;
        return false;
    });
    
    const aiReviewed = subjectGrades.filter(g => {
        // New format: reviewType === 'ai'
        if (g.reviewType === 'ai') return true;
        // Old format: isAIReviewed === true
        if (g.reviewType === undefined && g.isAIReviewed === true) return true;
        return false;
    });
    
    console.log('updatePerformanceStats - Self-reviewed:', selfReviewed.length, 'AI-reviewed:', aiReviewed.length);
    console.log('updatePerformanceStats - Unclassified:', subjectGrades.length - selfReviewed.length - aiReviewed.length);
    
    // Calculate stats for self-reviewed
    const selfStats = calculateStats(selfReviewed);
    document.getElementById('selfQuestionsCount').textContent = selfStats.count;
    document.getElementById('selfPossibleMarks').textContent = selfStats.possibleMarks;
    document.getElementById('selfScoredMarks').textContent = selfStats.scoredMarks.toFixed(1);
    
    const selfPerfBadge = document.getElementById('selfPerformance');
    selfPerfBadge.textContent = `${selfStats.performance}%`;
    selfPerfBadge.className = 'performance-badge';
    if (selfStats.performance >= 60) selfPerfBadge.classList.add('high');
    else if (selfStats.performance >= 40) selfPerfBadge.classList.add('medium');
    else selfPerfBadge.classList.add('low');
    
    // Calculate stats for AI-reviewed
    const aiStats = calculateStats(aiReviewed);
    document.getElementById('aiQuestionsCount').textContent = aiStats.count;
    document.getElementById('aiPossibleMarks').textContent = aiStats.possibleMarks;
    document.getElementById('aiScoredMarks').textContent = aiStats.scoredMarks.toFixed(1);
    
    const aiPerfBadge = document.getElementById('aiPerformance');
    aiPerfBadge.textContent = `${aiStats.performance}%`;
    aiPerfBadge.className = 'performance-badge';
    if (aiStats.performance >= 60) aiPerfBadge.classList.add('high');
    else if (aiStats.performance >= 40) aiPerfBadge.classList.add('medium');
    else aiPerfBadge.classList.add('low');
}

function calculateStats(gradings) {
    if (gradings.length === 0) {
        return {
            count: 0,
            possibleMarks: 0,
            scoredMarks: 0,
            performance: 0
        };
    }
    
    const count = gradings.length;
    const possibleMarks = gradings.reduce((sum, g) => sum + (g.maxMarks || 0), 0);
    const scoredMarks = gradings.reduce((sum, g) => sum + (g.marks || 0), 0);
    const performance = possibleMarks > 0 ? Math.round((scoredMarks / possibleMarks) * 100) : 0;
    
    return { count, possibleMarks, scoredMarks, performance };
}

function renderQuestionSections(attempted, available, unavailable, unavailableCount) {
    attemptedList.innerHTML = '';
    notAttemptedList.innerHTML = '';

    attemptedCountEl.textContent = attempted.length;
    notAttemptedCountEl.textContent = available.length + unavailable.length;

    // Store all available (non-unavailable) questions in sessionStorage for navigation
    const allAvailableQuestions = [...attempted.map(a => a.q), ...available];
    sessionStorage.setItem('questionsList', JSON.stringify(allAvailableQuestions));

    if (attempted.length === 0) {
        attemptedList.innerHTML = '<p class="empty-state-message">No questions attempted yet</p>';
    } else {
        attempted.forEach(({ q, grade }) => {
            const item = createQuestionItem(q, true, grade);
            attemptedList.appendChild(item);
        });
    }

    if (available.length === 0 && unavailable.length === 0) {
        notAttemptedList.innerHTML = '<p class="empty-state-message">No available questions</p>';
    } else {
        // First add available questions
        available.forEach(q => {
            const item = createQuestionItem(q, false, null);
            notAttemptedList.appendChild(item);
        });
        
        // Then add unavailable questions
        unavailable.forEach(q => {
            const item = createQuestionItem(q, false, null, true); // Pass true for isUnavailable
            notAttemptedList.appendChild(item);
        });
    }
}

function createQuestionItem(q, isAttempted, grade, isUnavailable = false) {
    const div = document.createElement('div');
    div.className = 'paper-item';
    
    // Add unavailable styling
    if (isUnavailable) {
        div.style.opacity = '0.6';
        div.style.cursor = 'not-allowed';
    }

    const basename = (q.output||'').split(/[\\/]/).pop() || q.output;
    const title = formatQuestionName(basename);

    // Try to determine the year for the badge: prefer explicit metadata, then filename
    let year = q.year || q.session_year || null;
    if (!year) {
        const m = basename.match(/(19|20)\d{2}/);
        if (m) year = m[0];
    }

    // Normalize question number: strip leading 'Q' if present (manifest sometimes stores 'Q6')
    let questionNum = '';
    if (q.question) {
        questionNum = q.question.toString().replace(/^q/i, '');
    } else {
        // fallback: try to parse from filename like _Q6
        const mq = basename.match(/_Q(\d+)\.md$/i);
        if (mq) questionNum = mq[1];
    }

    let scoreHTML = '';
    if (isAttempted && grade) {
        const percentage = grade.performance || Math.round(((grade.marks||0)/(grade.maxMarks||1))*100);
        let scoreClass = 'score-low';
        if (percentage >= 60) scoreClass = 'score-high';
        else if (percentage >= 40) scoreClass = 'score-medium';
        scoreHTML = `<div class="paper-score-badge ${scoreClass}">Grade: ${percentage}%</div>`;
    } else if (isAttempted) {
        scoreHTML = `<div class="paper-score-badge not-graded">Not graded</div>`;
    }

    const pdfBannerHTML = '';
    
    // Determine action label and styling
    let actionLabel, actionClass;
    if (isUnavailable) {
        actionLabel = 'NOT AVAILABLE';
        actionClass = 'unavailable';
    } else if (isAttempted) {
        actionLabel = 'REVIEW';
        actionClass = 'completed';
    } else {
        actionLabel = 'START';
        actionClass = 'new';
    }

    div.innerHTML = `
        ${pdfBannerHTML}
        <div class="paper-item-content">
            <div class="paper-item-left">
                <div class="paper-badge ${isAttempted ? 'attempted' : (isUnavailable ? 'unavailable' : 'available')}">
                    <div style="font-size:0.95rem; font-weight:700;">${year || ''}</div>
                    <div style="font-size:0.7rem; margin-top:0.25rem;">${questionNum ? `Q${questionNum}` : ''}</div>
                </div>
                <div class="paper-info">
                    <div class="paper-title">${title}</div>
                    <div style="color:#666; margin-top:0.25rem;">${(q.chapters||[]).join(', ')}</div>
                    ${scoreHTML}
                </div>
            </div>
            <div class="paper-action">
                <span class="action-label ${actionClass}">${actionLabel}</span>
                ${isUnavailable ? '' : `
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                `}
            </div>
        </div>
    `;

    div.addEventListener('click', () => {
        // Don't navigate if unavailable
        if (isUnavailable) {
            return;
        }
        // Normalize output path for page-relative fetch in the editor
        const outRaw = q.output || '';
        let outNorm = outRaw.replace(/\\/g, '/');
        if (outNorm && !outNorm.startsWith('/') && !outNorm.startsWith('../') && !outNorm.startsWith('./')) {
            outNorm = `../${outNorm}`;
        }
        const qForStorage = Object.assign({}, q, { output: outNorm });
        sessionStorage.setItem('selectedQuestion', JSON.stringify(qForStorage));
        sessionStorage.setItem('selectedSubject', subject);
        sessionStorage.setItem('selectedChapter', chapter);
        
        // Show review modal for attempted questions, otherwise go to editor
        if (isAttempted) {
            showReviewTypeModal(qForStorage);
        } else {
            window.location.href = `question-editor.html`;
        }
    });

    return div;
}

// Set up modal button event listeners immediately
console.log('=== Starting modal button setup ===');
const selfReviewBtn = document.getElementById('selfReviewBtn');
const aiReviewBtn = document.getElementById('aiReviewBtn');
const reviewTypeModal = document.getElementById('reviewTypeModal');
const aiInstructionsModal = document.getElementById('aiInstructionsModal');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const closeAiInstructionsBtn = document.getElementById('closeAiInstructionsBtn');

console.log('Button elements:', {
    selfReviewBtn: !!selfReviewBtn,
    aiReviewBtn: !!aiReviewBtn,
    reviewTypeModal: !!reviewTypeModal,
    aiInstructionsModal: !!aiInstructionsModal,
    copyPromptBtn: !!copyPromptBtn,
    closeAiInstructionsBtn: !!closeAiInstructionsBtn
});

if (selfReviewBtn) {
    selfReviewBtn.addEventListener('click', () => {
        hideReviewTypeModal();
        // Navigate to grading page for self-review
        sessionStorage.setItem('reviewType', 'self');
        window.location.href = `chapter-question-grading.html`;
    });
}

if (aiReviewBtn) {
    aiReviewBtn.addEventListener('click', async () => {
        hideReviewTypeModal();
        // Store review type for AI review
        sessionStorage.setItem('reviewType', 'ai');
        // Show AI instructions modal
        await showAiInstructionsModal(currentSelectedQuestion);
    });
}

// Close modal when clicking outside
if (reviewTypeModal) {
    reviewTypeModal.addEventListener('click', (e) => {
        if (e.target === reviewTypeModal) hideReviewTypeModal();
    });
}

if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
        const promptText = document.getElementById('aiPromptText');
        promptText.select();
        document.execCommand('copy');
        
        // Visual feedback
        const originalText = copyPromptBtn.textContent;
        copyPromptBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyPromptBtn.textContent = originalText;
        }, 2000);
    });
}

if (closeAiInstructionsBtn) {
    console.log('Attaching click handler to closeAiInstructionsBtn');
    closeAiInstructionsBtn.addEventListener('click', () => {
        console.log('closeAiInstructionsBtn clicked!');
        hideAiInstructionsModal();
    });
} else {
    console.error('closeAiInstructionsBtn element not found!');
}

if (aiInstructionsModal) {
    aiInstructionsModal.addEventListener('click', (e) => {
        if (e.target === aiInstructionsModal) hideAiInstructionsModal();
    });
}

