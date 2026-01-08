// Chapter Question Grading functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { attachSignOutHandler } from './signout-modal.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

// Attach sign out handler
attachSignOutHandler('#signOutBtn');

let currentUser = null;
let isAuthChecked = false;
let questionData = null;
let userAnswer = null;

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

// Parse frontmatter from markdown (same as question-editor.js)
function parseFrontmatter(md) {
    // Support both LF and CRLF line endings and optional spaces after '---'
    const m = md.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
    if (!m) return { body: md };
    const fm = m[1];
    const body = md.slice(m[0].length).trim();
    const obj = {};
    fm.split('\n').forEach(line => {
        const kv = line.split(':');
        if (kv.length >=2) {
            const k = kv[0].trim();
            const v = kv.slice(1).join(':').trim().replace(/^'|'$/g,'');
            obj[k] = v;
        }
    });
    return { frontmatter: obj, body };
}

// Preformat a question markdown/body string before rendering (same as question-editor.js)
// Removes duplicated header lines (e.g., leading 'QUESTION 6'),
// splits enumerated parts (i, ii, iii...) into separate paragraphs with bold labels,
// normalises marks like '[Total 15]' and per-part marks in square brackets, and
// returns a cleaned markdown string ready for the minimal renderer.
function preformatQuestionBody(body) {
    if (!body) return '';
    let s = body.trim();
    // Remove any leading uppercase QUESTION header lines like 'QUESTION 6' or 'QUESTION 6 A.'
    s = s.replace(/^\s*QUESTION\s+\d+[A-Za-z\.]*(?:[:\s-]*)/i, '');
    // Also remove any leading 'Question 6' variants
    s = s.replace(/^\s*Question\s+\d+[A-Za-z\.]*(?:[:\s-]*)/i, '');

    // Turn multiple newlines into two-newline separators to keep paragraphs
    s = s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    // Normalize marks: ensure '[Total N]' appears on its own line
    s = s.replace(/\[Total\s*(\d+)\]/i, '\n\n**[Total $1]**\n\n');

    // Split part labels like 'i. ', 'ii) ', 'a) ' at line starts into bold headings
    s = s.replace(/(^|\n)\s*([ivx]+)\.|(^|\n)\s*([ivx]+)\)/gi, (m) => {
        // convert 'i.' or 'ii)' into '**i.** '
        const label = m.replace(/(^|\n)\s*/,'').trim();
        return `\n\n**${label}** `;
    });

    // Also catch enumerated roman/numbered items like 'i. Describe...' on same line
    s = s.replace(/(^|\n)\s*\*?\(?([ivx]+|[a-zA-Z0-9]+)\)?[\.\)]\s+/g, (m, p1, p2) => `\n\n**${p2}.** `);

    // Trim again and ensure single spacing
    s = s.replace(/\n{2,}/g, '\n\n').trim();

    return s;
}

// Minimal markdown renderer
function renderMarkdown(md) {
    if (!md) return '<p>No content available</p>';
    const esc = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let html = esc.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/\n/g,'\n')}</code></pre>`);
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/(^|\n)\s*[-\*+] (.*)/g, (m, p1, p2) => `\n<li>${p2}</li>`);
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g,'');
    return html;
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

// DOM elements
const questionContent = document.getElementById('questionContent');
const userAnswerContent = document.getElementById('userAnswerContent');
const solutionContent = document.getElementById('solutionContent');
// Assessment Dimensions elements removed
const totalMarksInput = document.getElementById('totalMarksInput');
const marksInput = document.getElementById('marksInput');
const totalMarksHint = document.getElementById('totalMarksHint');
const calculatedGrade = document.getElementById('calculatedGrade');
const calculatedPercentage = document.getElementById('calculatedPercentage');
const completeReviewBtn = document.getElementById('completeReviewBtn');
const backBtn = document.getElementById('backBtn');

// Initialize page
async function initializePage() {
    // Get question data from session storage
    const questionStr = sessionStorage.getItem('selectedQuestion');
    if (!questionStr) {
        showModal('Error', 'No question selected. Redirecting...', 'error', [
            { text: 'OK', primary: true, callback: () => window.history.back() }
        ]);
        return;
    }

    questionData = JSON.parse(questionStr);
    
    // Load question content
    await loadQuestionContent();
    
    // Load user's answer
    await loadUserAnswer();
    
    // Load solution
    await loadSolution();
    
    // Setup event listeners
    setupEventListeners();
}

// Load question content
async function loadQuestionContent() {
    try {
        // Use the same path resolution logic as question-editor.js
        let resolvedPath = questionData.output || '';
        if (resolvedPath && !resolvedPath.startsWith('/') && !resolvedPath.startsWith('../') && !resolvedPath.startsWith('./')) {
            resolvedPath = `../${resolvedPath}`;
        }
        
        // Try multiple candidate paths
        const normalized = (resolvedPath || '').replace(/\\/g, '/');
        const raw = normalized.replace(/^(?:\.\/|(?:\.\.\/)+)*/, '');
        
        const candidates = [];
        const topMatch = raw.match(/^([^\/]+)\/(.+)$/);
        if (topMatch) {
            const withoutTop = topMatch[2];
            candidates.push(`/${withoutTop}`);
            candidates.push(withoutTop);
        }
        candidates.push(raw);
        candidates.push(`/${raw}`);
        candidates.push(`../${raw}`);
        candidates.push(`./${raw}`);
        
        let markdown = null;
        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate);
                if (response.ok) {
                    markdown = await response.text();
                    console.log('Question loaded from:', candidate);
                    break;
                }
            } catch (e) {
                // Continue to next candidate
            }
        }
        
        if (!markdown) {
            throw new Error('Failed to load question from all candidate paths');
        }
        
        // Parse frontmatter and format the body (same as question-editor.js)
        const parsed = parseFrontmatter(markdown);
        const formattedBody = preformatQuestionBody(parsed.body);
        questionContent.innerHTML = renderMarkdown(formattedBody);
    } catch (error) {
        console.error('Error loading question:', error);
        questionContent.innerHTML = '<p style="color: #ff4444;">Failed to load question content</p>';
    }
}

// Load user's saved answer
async function loadUserAnswer() {
    try {
        // Get the basename from the question output path (same as question-editor.js)
        const resolvedPath = questionData.output || '';
        const basename = (resolvedPath||'').split(/[\/\\]/).pop() || resolvedPath;
        
        // Create draft key same as question-editor.js
        const draftKey = `draft_${basename}`;
        
        // Try to load from localStorage
        const savedAnswer = localStorage.getItem(draftKey);
        
        if (savedAnswer) {
            userAnswer = savedAnswer;
            // Convert plain text to simple HTML paragraphs
            const paragraphs = userAnswer.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
            userAnswerContent.innerHTML = paragraphs || '<p style="color: #999;">No answer provided</p>';
        } else {
            userAnswerContent.innerHTML = '<p style="color: #999;">No answer saved yet</p>';
        }
    } catch (error) {
        console.error('Error loading user answer:', error);
        userAnswerContent.innerHTML = '<p style="color: #ff4444;">Failed to load your answer</p>';
    }
}

// Load solution (memo)
async function loadSolution() {
    try {
        // Try to find the corresponding memo file
        // Replace "questions" path with "memos" and change filename pattern
        let memoPath = questionData.output.replace('/questions/', '/memos/');
        memoPath = memoPath.replace(/(_Q\d+)\.md$/, '$1_memo.md');
        
        const response = await fetch(memoPath);
        if (!response.ok) throw new Error('Solution not available');
        const markdown = await response.text();
        solutionContent.innerHTML = renderMarkdown(markdown);
    } catch (error) {
        console.error('Error loading solution:', error);
        solutionContent.innerHTML = '<p style="color: #999;">Solution not available for this question</p>';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Assessment dimension sliders removed
    
    // Total marks input
    totalMarksInput.addEventListener('input', () => {
        totalMarksHint.textContent = totalMarksInput.value || '0';
        calculateGrade();
    });
    
    // Marks awarded input
    marksInput.addEventListener('input', calculateGrade);
    
    // Complete review button
    completeReviewBtn.addEventListener('click', handleCompleteReview);
    
    // Back button
    backBtn.addEventListener('click', () => window.history.back());
}

// Calculate grade
function calculateGrade() {
    const total = parseFloat(totalMarksInput.value) || 0;
    const awarded = parseFloat(marksInput.value) || 0;
    
    if (total === 0) {
        calculatedGrade.textContent = '-';
        calculatedPercentage.textContent = '-';
        return;
    }
    
    const percentage = Math.round((awarded / total) * 100);
    calculatedPercentage.textContent = `${percentage}%`;
    
    // Determine grade
    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';
    
    calculatedGrade.textContent = grade;
}

// Handle complete review
async function handleCompleteReview() {
    const total = parseFloat(totalMarksInput.value) || 0;
    const awarded = parseFloat(marksInput.value) || 0;
    
    if (total === 0) {
        showModal('Missing Information', 'Please enter the total marks available.', 'error');
        return;
    }
    
    // Prepare grading data (assessment dimensions removed)
    const gradeData = {
        marks: awarded,
        maxMarks: total,
        performance: Math.round((awarded / total) * 100),
        timestamp: Date.now()
    };
    
    // Extract question metadata from filename
    const basename = (questionData.output || '').split(/[\/\\]/).pop() || '';
    const match = basename.match(/([^_]+)_([^_]+)_(\d{4})_Paper(\d+)_Q(\d+)\.md$/i);
    
    if (match) {
        gradeData.subject = match[1];
        gradeData.session = match[2];
        gradeData.year = match[3];
        gradeData.paper = match[4];
        gradeData.question = match[5];
    }
    
    try {
        // Save to Firestore
        await firestoreData.saveQuestionGrade(currentUser.uid, gradeData);
        
        // Also save to IndexedDB as backup
        await indexedDBStorage.saveQuestionGrade(currentUser.uid, gradeData);
        
        showModal('Review Complete', 'Your review has been saved successfully!', 'success', [
            { text: 'OK', primary: true, callback: () => window.history.back() }
        ]);
    } catch (error) {
        console.error('Error saving review:', error);
        showModal('Error', 'Failed to save your review. Please try again.', 'error');
    }
}
