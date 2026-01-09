// Chapter Question Grading functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { attachSignOutHandler } from './signout-modal.js';

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
let questionsList = [];
let currentQuestionIndex = -1;

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
const nextQuestionBtn = document.getElementById('nextQuestionBtn');

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
    
    // Get questions list and find current index
    const questionsListStr = sessionStorage.getItem('questionsList');
    if (questionsListStr) {
        try {
            questionsList = JSON.parse(questionsListStr);
            // Find current question index by matching output path
            // Normalize both paths for comparison (remove ../ prefix and backslashes)
            const normalizeForComparison = (path) => {
                if (!path) return '';
                return path.replace(/\\/g, '/').replace(/^\.\.\//, '');
            };
            const currentPath = normalizeForComparison(questionData.output);
            currentQuestionIndex = questionsList.findIndex(q => 
                normalizeForComparison(q.output) === currentPath
            );
            console.log('Questions list:', questionsList.length, 'Current index:', currentQuestionIndex);
        } catch (e) {
            console.warn('Failed to parse questions list', e);
        }
    }
    
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
        
        // Get the basename for formatting
        const basename = (questionData.output || '').split(/[\\/]/).pop() || questionData.output;
        const readableName = formatQuestionName(basename);
        
        // Parse frontmatter and format the body (same as question-editor.js)
        const parsed = parseFrontmatter(markdown);
        const formattedBody = preformatQuestionBody(parsed.body);
        questionContent.innerHTML = `
            <div style="color: #666; font-size: 0.9rem; margin-bottom: 1rem; font-weight: 500;">${readableName}</div>
            ${renderMarkdown(formattedBody)}
        `;
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
        // Parse question path to get subject, session, year, paper, and question number
        // Example: resources/markdown_questions/questions/F102/NOVEMBER/2010/Paper1/questions/F102_NOVEMBER_2010_Paper1_Q1.md
        const questionPath = questionData.output || '';
        
        console.log('Original question path:', questionPath);
        
        // Normalize the path and split it
        const normalizedPath = questionPath.replace(/\\/g, '/');
        const pathParts = normalizedPath.split('/');
        
        console.log('Path parts:', pathParts);
        
        // Find the index of "questions" folder (first occurrence)
        const questionsIndex = pathParts.indexOf('questions');
        if (questionsIndex === -1) {
            throw new Error('Invalid question path format');
        }
        
        // Extract components: questions/F102/SESSION/YEAR/Paper/questions/filename.md
        const subject = pathParts[questionsIndex + 1]; // F102
        const session = pathParts[questionsIndex + 2]; // JUNE or NOVEMBER
        const year = pathParts[questionsIndex + 3];    // 2010
        const paper = pathParts[questionsIndex + 4];   // Paper1 or Papergeneral
        
        // Extract question number from filename
        // Example: F102_NOVEMBER_2010_Paper1_Q1.md -> Q1
        const filename = pathParts[pathParts.length - 1];
        const qMatch = filename.match(/_Q(\d+)\.md$/);
        const questionNum = qMatch ? qMatch[1] : '1';
        
        // Construct solution path based on the split examiner reports structure
        // Solutions are in: resources/markdown_questions/solutions/F102/YEAR/SESSION/PaperX/F102_SESSION_YEAR_PaperX_Q1.md
        // Note: Some examiner reports use "Papergeneral" instead of specific paper numbers
        const solutionPaths = [
            `../resources/markdown_questions/solutions/${subject}/${year}/${session}/${paper}/${subject}_${session}_${year}_${paper}_Q${questionNum}.md`,
            `../resources/markdown_questions/solutions/${subject}/${year}/${session}/Papergeneral/${subject}_${session}_${year}_Papergeneral_Q${questionNum}.md`
        ];
        
        console.log('Attempting to load solution from:', solutionPaths[0]);
        
        let response = await fetch(solutionPaths[0]);
        if (!response.ok) {
            console.log('First path failed, trying:', solutionPaths[1]);
            response = await fetch(solutionPaths[1]);
            if (!response.ok) {
                throw new Error(`Solution not found at ${solutionPaths[0]} or ${solutionPaths[1]}`);
            }
        }
        
        const markdown = await response.text();
        
        // Parse the markdown and render it
        const parsed = parseFrontmatter(markdown);
        solutionContent.innerHTML = renderMarkdown(parsed.body || markdown);
        
        console.log('Solution loaded successfully');
    } catch (error) {
        console.error('Error loading solution:', error);
        solutionContent.innerHTML = '<p style="color: #999;">Solution not available for this question. The examiner report may not be available for this paper.</p>';
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
    
    // Back button - navigate back to chapter questions with subject and chapter
    backBtn.addEventListener('click', () => {
        const subject = sessionStorage.getItem('selectedSubject');
        const chapter = sessionStorage.getItem('selectedChapter');
        if (subject && chapter) {
            window.location.href = `chapter-questions.html?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`;
        } else {
            window.history.back();
        }
    });
    
    // Next question button
    if (nextQuestionBtn) {
        // Show/hide based on whether there's a next question
        if (currentQuestionIndex >= 0 && currentQuestionIndex < questionsList.length - 1) {
            nextQuestionBtn.style.display = 'flex';
            nextQuestionBtn.addEventListener('click', handleNextQuestion);
        } else {
            nextQuestionBtn.style.display = 'none';
        }
    }
}

// Calculate grade
function calculateGrade() {
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

// Handle complete review
async function handleCompleteReview() {
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
    
    // Note: Chapter grading page doesn't have dimension sliders
    // Dimensions are only available in the main question-grading.html page
    const dimensions = {
        keyIdeas: 0,
        useOfInfo: 0,
        conciseness: 0,
        ideaGeneration: 0
    };
    
    // Extract question metadata from filename
    const basename = (questionData.output || '').split(/[\/\\]/).pop() || '';
    const readableName = formatQuestionName(basename);
    const match = basename.match(/([^_]+)_([^_]+)_(\d{4})_Paper(\d+)_Q(\d+)\.md$/i);
    
    let subject = '', session = '', year = '', paper = '', questionNumber = '';
    if (match) {
        subject = match[1];
        session = match[2];
        year = match[3];
        paper = match[4];
        questionNumber = match[5];
    }
    
    // Create summary for confirmation
    const summaryHTML = `
        <div style="text-align: left; margin: 1rem 0;">
            <p style="margin-bottom: 0.5rem;"><strong>Question:</strong> ${readableName}</p>
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
                callback: async () => {
                    // Create grading record
                    const gradingData = {
                        subject: subject,
                        session: session,
                        year: parseInt(year),
                        paper: paper,
                        question: questionNumber,
                        dimensions: dimensions,
                        grade: grade,
                        marks: marksAwarded,
                        maxMarks: totalMarks,
                        performance: Math.round((marksAwarded / totalMarks) * 100),
                        timestamp: new Date().toISOString(),
                        studentEmail: currentUser.email
                    };
                    
                    // Save to Firestore and IndexedDB
                    try {
                        await saveGradingData(gradingData);
                        console.log('Grading data saved successfully');
                        
                        // Show success message with options
                        const backSubject = sessionStorage.getItem('selectedSubject');
                        const backChapter = sessionStorage.getItem('selectedChapter');
                        
                        showModal(
                            'Review Completed!',
                            'Your grading has been saved successfully. What would you like to do next?',
                            'success',
                            [
                                { 
                                    text: 'Return to Chapter Questions', 
                                    primary: true, 
                                    callback: () => {
                                        if (backSubject && backChapter) {
                                            window.location.href = `chapter-questions.html?subject=${encodeURIComponent(backSubject)}&chapter=${encodeURIComponent(backChapter)}`;
                                        } else {
                                            window.history.back();
                                        }
                                    }
                                },
                                { 
                                    text: 'Stay on This Page', 
                                    primary: false, 
                                    callback: null 
                                }
                            ]
                        );
                    } catch (error) {
                        console.error('Error saving grading data:', error);
                        showModal(
                            'Save Failed',
                            'Failed to save grading data. Please try again.',
                            'error'
                        );
                    }
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
        existingGrade = await firestoreData.getQuestionGrade(currentUser.uid, questionData);
    } catch (error) {
        console.warn('Could not load grade from Firestore:', error);
    }
    
    if (!existingGrade) {
        try {
            // Fallback to IndexedDB
            existingGrade = await indexedDBStorage.getQuestionGrade(currentUser.uid, questionData);
        } catch (error) {
            console.warn('Could not load grade from IndexedDB:', error);
        }
    }
    
    if (existingGrade) {
        // Populate the form with existing grade
        marksInput.value = existingGrade.marks || 0;
        totalMarksInput.value = existingGrade.maxMarks || 0;
        
        if (existingGrade.dimensions) {
            keyIdeasSlider.value = existingGrade.dimensions.keyIdeas || 3;
            useOfInfoSlider.value = existingGrade.dimensions.useOfInfo || 3;
            concisenessSlider.value = existingGrade.dimensions.conciseness || 3;
            ideaGenerationSlider.value = existingGrade.dimensions.ideaGeneration || 3;
            
            updateSliderLabels();
        }
        
        // Trigger calculation
        calculateGrade();
    }
}

// Handle next question
function handleNextQuestion() {
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questionsList.length - 1) {
        const nextQuestion = questionsList[currentQuestionIndex + 1];
        
        // Normalize output path for page-relative fetch
        const outRaw = nextQuestion.output || '';
        let outNorm = outRaw.replace(/\\/g, '/');
        if (outNorm && !outNorm.startsWith('/') && !outNorm.startsWith('../') && !outNorm.startsWith('./')) {
            outNorm = `../${outNorm}`;
        }
        const qForStorage = Object.assign({}, nextQuestion, { output: outNorm });
        
        // Update session storage with next question
        sessionStorage.setItem('selectedQuestion', JSON.stringify(qForStorage));
        
        // Navigate to question editor to attempt the next question
        window.location.href = 'question-editor.html';
    }
}
