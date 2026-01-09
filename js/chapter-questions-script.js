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

if (!subject || !chapter) {
    container.innerHTML = '<p style="color:#666; padding:1rem;">No subject or chapter selected.</p>';
} else {
    // Set page title to only show the chapter name
    const chap = (chapter || '').trim();
    const title = chap || '';
    document.getElementById('pageTitle').textContent = title;
    subjectChapterTitle.textContent = title;
    const topHeader = document.querySelector('.subjects-header');
    if (topHeader) topHeader.style.display = 'none';
    
    Promise.all([
        loadManifest(subject),
        loadUnavailablePapers()
    ]).then(([manifest, unavailable]) => {
        const questions = manifest.filter(item => (item.chapters||[]).includes(chapter));
        const filtered = filterAvailableQuestions(questions, unavailable, subject);
        loadAndRenderQuestions(filtered.available, filtered.unavailableCount);
    }).catch(err => {
        console.error('Failed to load manifest for subject', subject, err);
        container.innerHTML = '<p style="color:#666; padding:1rem;">Failed to load questions for this chapter.</p>';
    });
}

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
        
        // grading id format: grade_<user>_<subject>_<year>_<session>_P<paper>_Q<question>
        const parts = (q.output||'').split(/[_\/\\\.]/);
        // Try to parse year/session/paper/question from q metadata if present
        const year = q.year || q.session_year || null;
        const sessionType = q.session || q.session_type || null;
        const paper = q.paper || q.paper_no || null;
        const questionNo = q.question || null;

        const matched = gradings.find(g => {
            // Match on manifest fields where available
            if (g.subject && g.subject !== subject) return false;
            if (questionNo && g.question != questionNo) return false;
            if (paper && g.paper != paper) return false;
            if (year && g.year && g.year != year) return false;
            if (sessionType && g.session && g.session.toLowerCase() !== sessionType.toLowerCase()) return false;
            // Also allow matching by filename if manifest fields missing
            if (!g.subject && !g.year && !g.paper && !g.question) return false;
            return true;
        });

        if (matched) attempted.push({ q, grade: matched });
        else available.push(q);
    }

    renderQuestionSections(attempted, available, unavailable, unavailableCount);
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
        window.location.href = `question-editor.html`;
    });

    return div;
}
