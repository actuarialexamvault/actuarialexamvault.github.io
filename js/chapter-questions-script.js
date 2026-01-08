import { themeManager } from './theme-manager.js';
import { attachSignOutHandler } from './signout-modal.js';
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';

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

backBtn.addEventListener('click', () => { window.history.back(); });

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
    loadManifest(subject).then(manifest => {
        const questions = manifest.filter(item => (item.chapters||[]).includes(chapter));
        loadAndRenderQuestions(questions);
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

async function loadAndRenderQuestions(questions) {
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

    for (const q of questions) {
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

    renderQuestionSections(attempted, available);
}

function renderQuestionSections(attempted, available) {
    attemptedList.innerHTML = '';
    notAttemptedList.innerHTML = '';

    attemptedCountEl.textContent = attempted.length;
    notAttemptedCountEl.textContent = available.length;

    if (attempted.length === 0) {
        attemptedList.innerHTML = '<p class="empty-state-message">No questions attempted yet</p>';
    } else {
        attempted.forEach(({ q, grade }) => {
            const item = createQuestionItem(q, true, grade);
            attemptedList.appendChild(item);
        });
    }

    if (available.length === 0) {
        notAttemptedList.innerHTML = '<p class="empty-state-message">No available questions</p>';
    } else {
        available.forEach(q => {
            const item = createQuestionItem(q, false, null);
            notAttemptedList.appendChild(item);
        });
    }
}

function createQuestionItem(q, isAttempted, grade) {
    const div = document.createElement('div');
    div.className = 'paper-item';

    const basename = (q.output||'').split(/[\\/]/).pop() || q.output;
    const title = basename;

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

    div.innerHTML = `
        ${pdfBannerHTML}
        <div class="paper-item-content">
            <div class="paper-item-left">
                <div class="paper-badge ${isAttempted ? 'attempted' : 'available'}">
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
                <span class="action-label ${isAttempted ? 'completed' : 'new'}">${isAttempted ? 'REVIEW' : 'START'}</span>
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        </div>
    `;

    div.addEventListener('click', () => {
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
