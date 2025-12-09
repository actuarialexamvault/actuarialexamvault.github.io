// Subject Papers page functionality
const authManager = new AuthManager();

const signOutBtn = document.getElementById('signOutBtn');
const availableHeader = document.getElementById('availableHeader');
const availableList = document.getElementById('availableList');

// Check if user is logged in
const session = authManager.getSession();
if (!session) {
    alert('Please sign in to access papers.');
    window.location.href = 'signin.html';
}

// Get subject from URL or sessionStorage
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || sessionStorage.getItem('selectedSubject');
const subjectTitle = sessionStorage.getItem('selectedSubjectTitle');

if (!subject) {
    window.location.href = 'subjects.html';
}

// Generate available papers based on subject and years (2018-2025)
function generateAvailablePapers() {
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
                    paper: 'Paper 1', 
                    status: 'NEW ATTEMPT',
                    displayYear: `${session} ${year}`
                });
                papers.push({ 
                    year: year, 
                    session: session, 
                    paper: 'Paper 2', 
                    status: 'NEW ATTEMPT',
                    displayYear: `${session} ${year}`
                });
            } else {
                // Other subjects have only one paper per session
                papers.push({ 
                    year: year, 
                    session: session, 
                    paper: 'Paper 1', 
                    status: 'NEW ATTEMPT',
                    displayYear: `${session} ${year}`
                });
            }
        });
    });
    
    return papers;
}

const availablePapers = generateAvailablePapers();

// Load available papers
function loadAvailablePapers() {
    availableList.innerHTML = '';
    
    if (availablePapers.length === 0) {
        availableList.innerHTML = '<p style="color: #666; padding: 1rem;">No available papers</p>';
        return;
    }
    
    availablePapers.forEach(paper => {
        const paperItem = createPaperItem(paper, 'available');
        availableList.appendChild(paperItem);
    });
}

// Create paper item element
function createPaperItem(paper, type) {
    const div = document.createElement('div');
    div.className = 'paper-item';
    
    div.innerHTML = `
        <div class="paper-item-left">
            <div class="paper-badge available">
                <div>${paper.displayYear}</div>
                <div style="font-size: 0.75rem; margin-top: 0.25rem;">${paper.paper}</div>
            </div>
            <div class="paper-info">
                <div class="paper-title">${subjectTitle || 'Subject'} - ${paper.displayYear} ${paper.paper}</div>
            </div>
        </div>
        <div class="paper-action">
            <span class="action-label new">${paper.status}</span>
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `;
    
    div.addEventListener('click', () => {
        handlePaperClick(paper);
    });
    
    return div;
}

// Handle paper click
function handlePaperClick(paper) {
    // Extract paper number (1 or 2) from paper.paper string
    const paperNumber = paper.paper.includes('2') ? '2' : '1';
    
    // Navigate to exam instructions page with paper details
    const params = new URLSearchParams({
        subject: subject,
        subjectTitle: subjectTitle || 'Subject',
        session: paper.session.toUpperCase(),
        year: paper.year,
        paper: paperNumber
    });
    
    window.location.href = `exam-instructions.html?${params.toString()}`;
}

// Toggle section collapse
availableHeader.addEventListener('click', () => {
    availableHeader.classList.toggle('collapsed');
    availableList.classList.toggle('hidden');
});

// Handle sign out
signOutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        authManager.signOut();
        alert('You have been signed out successfully.');
        window.location.href = '../index.html';
    }
});

// Add click handlers for sidebar sections
document.querySelectorAll('.sidebar-section').forEach((section, index) => {
    section.addEventListener('click', () => {
        const features = ['Do Questions', 'Question Bank', 'Intelligence'];
        alert(`${features[index]} feature coming soon!\n\nThis will provide additional ways to practice and study.`);
    });
});

// Load data on page load
loadAvailablePapers();

// Activity timer
let activityTimeout;
function resetActivityTimer() {
    clearTimeout(activityTimeout);
    if (authManager.isLoggedIn()) {
        authManager.extendSession();
        activityTimeout = setTimeout(() => {}, 5 * 60 * 1000);
    }
}

['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetActivityTimer, true);
});

resetActivityTimer();
