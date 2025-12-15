// Papers page functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

const signOutBtn = document.getElementById('signOutBtn');
const subjectTitle = document.getElementById('subjectTitle');
const papersGrid = document.getElementById('papersGrid');
const noPapers = document.getElementById('noPapers');

let isAuthChecked = false;

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (!user && !isAuthChecked) {
        isAuthChecked = true;
        alert('Please sign in to access past papers.');
        window.location.href = 'signin.html';
    } else if (user) {
        isAuthChecked = true;
    }
});

// Get subject from URL or sessionStorage
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || sessionStorage.getItem('selectedSubject');
const subjectTitleText = sessionStorage.getItem('selectedSubjectTitle');

if (!subject) {
    window.location.href = 'subjects.html';
}

// Update page title
if (subjectTitleText) {
    subjectTitle.textContent = subjectTitleText;
}

// Papers database - organized by year
const papersDatabase = {
    '2016': [
        { file: '2016_June_PaperA_Q1.md', title: 'June Paper A - Question 1' },
        { file: '2016_June_PaperA_Q2.md', title: 'June Paper A - Question 2' },
        { file: '2016_June_PaperA_Q3.md', title: 'June Paper A - Question 3' },
        { file: '2016_June_PaperA_Q4.md', title: 'June Paper A - Question 4' },
        { file: '2016_June_PaperA_Q5.md', title: 'June Paper A - Question 5' },
        { file: '2016_June_PaperA_Q6.md', title: 'June Paper A - Question 6' },
        { file: '2016_June_PaperA_Q7.md', title: 'June Paper A - Question 7' },
        { file: '2016_June_PaperA_Q8.md', title: 'June Paper A - Question 8' },
        { file: '2016_June_PaperB_Q1.md', title: 'June Paper B - Question 1' },
        { file: '2016_June_PaperB_Q2.md', title: 'June Paper B - Question 2' },
        { file: '2016_June_PaperB_Q3.md', title: 'June Paper B - Question 3' },
        { file: '2016_June_PaperB_Q4.md', title: 'June Paper B - Question 4' },
        { file: '2016_June_PaperB_Q5.md', title: 'June Paper B - Question 5' },
        { file: '2016_June_PaperB_Q6.md', title: 'June Paper B - Question 6' },
        { file: '2016_June_PaperB_Q7.md', title: 'June Paper B - Question 7' },
        { file: '2016_June_PaperB_Q8.md', title: 'June Paper B - Question 8' },
        { file: '2016_June_PaperB_Q9.md', title: 'June Paper B - Question 9' },
        { file: 'Oct_2016_Paper2_Q4.md', title: 'October Paper 2 - Question 4' }
    ],
    '2017': [
        { file: 'May_2017_Paper2_Q4.md', title: 'May Paper 2 - Question 4' },
        { file: 'May_2017_Paper2_Q8.md', title: 'May Paper 2 - Question 8' }
    ],
    '2019': [
        { file: 'May_2019_Paper2_Q9.md', title: 'May Paper 2 - Question 9' },
        { file: 'Oct_2019_Paper2_Q4.md', title: 'October Paper 2 - Question 4' }
    ],
    '2020': [
        { file: 'May_2020_Paper1_Q2.md', title: 'May Paper 1 - Question 2' }
    ],
    '2022': [
        { file: '2022_June_Paper1_Q1.md', title: 'June Paper 1 - Question 1' },
        { file: '2022_June_Paper1_Q2.md', title: 'June Paper 1 - Question 2' },
        { file: '2022_June_Paper1_Q3.md', title: 'June Paper 1 - Question 3' },
        { file: '2022_June_Paper1_Q4.md', title: 'June Paper 1 - Question 4' },
        { file: '2022_June_Paper1_Q5.md', title: 'June Paper 1 - Question 5' },
        { file: '2022_June_Paper1_Q6.md', title: 'June Paper 1 - Question 6' },
        { file: '2022_June_Paper1_Q7.md', title: 'June Paper 1 - Question 7' },
        { file: '2022_June_Paper1_Q8.md', title: 'June Paper 1 - Question 8' },
        { file: '2022_June_Paper2_Q1.md', title: 'June Paper 2 - Question 1' },
        { file: '2022_June_Paper2_Q2.md', title: 'June Paper 2 - Question 2' },
        { file: '2022_June_Paper2_Q3.md', title: 'June Paper 2 - Question 3' },
        { file: '2022_June_Paper2_Q4.md', title: 'June Paper 2 - Question 4' },
        { file: '2022_June_Paper2_Q5.md', title: 'June Paper 2 - Question 5' },
        { file: '2022_June_Paper2_Q6.md', title: 'June Paper 2 - Question 6' },
        { file: '2022_June_Paper2_Q7.md', title: 'June Paper 2 - Question 7' },
        { file: '2022_June_Paper2_Q8.md', title: 'June Paper 2 - Question 8' },
        { file: '2022_November_Paper1_Q1.md', title: 'November Paper 1 - Question 1' },
        { file: '2022_November_Paper1_Q2.md', title: 'November Paper 1 - Question 2' },
        { file: '2022_November_Paper1_Q3.md', title: 'November Paper 1 - Question 3' },
        { file: '2022_November_Paper1_Q4.md', title: 'November Paper 1 - Question 4' },
        { file: '2022_November_Paper1_Q5.md', title: 'November Paper 1 - Question 5' },
        { file: '2022_November_Paper1_Q6.md', title: 'November Paper 1 - Question 6' },
        { file: '2022_November_Paper1_Q7.md', title: 'November Paper 1 - Question 7' },
        { file: '2022_November_Paper1_Q8.md', title: 'November Paper 1 - Question 8' },
        { file: '2022_November_Paper2_Q1.md', title: 'November Paper 2 - Question 1' },
        { file: '2022_November_Paper2_Q2.md', title: 'November Paper 2 - Question 2' },
        { file: '2022_November_Paper2_Q3.md', title: 'November Paper 2 - Question 3' },
        { file: '2022_November_Paper2_Q4.md', title: 'November Paper 2 - Question 4' },
        { file: '2022_November_Paper2_Q5.md', title: 'November Paper 2 - Question 5' },
        { file: '2022_November_Paper2_Q6.md', title: 'November Paper 2 - Question 6' },
        { file: '2022_November_Paper2_Q7.md', title: 'November Paper 2 - Question 7' },
        { file: '2022_November_Paper2_Q8.md', title: 'November Paper 2 - Question 8' }
    ],
    '2023': [
        { file: '2023_June_Paper1_Q1.md', title: 'June Paper 1 - Question 1' },
        { file: '2023_June_Paper1_Q2.md', title: 'June Paper 1 - Question 2' },
        { file: '2023_June_Paper1_Q3.md', title: 'June Paper 1 - Question 3' },
        { file: '2023_June_Paper1_Q4.md', title: 'June Paper 1 - Question 4' },
        { file: '2023_June_Paper1_Q5.md', title: 'June Paper 1 - Question 5' },
        { file: '2023_June_Paper1_Q6.md', title: 'June Paper 1 - Question 6' },
        { file: '2023_June_Paper1_Q7.md', title: 'June Paper 1 - Question 7' },
        { file: '2023_June_Paper2_Q1.md', title: 'June Paper 2 - Question 1' },
        { file: '2023_June_Paper2_Q2.md', title: 'June Paper 2 - Question 2' }
    ]
};

// Load papers for the subject
function loadPapers() {
    const years = Object.keys(papersDatabase).sort((a, b) => b - a); // Sort descending
    
    if (years.length === 0) {
        papersGrid.style.display = 'none';
        noPapers.style.display = 'flex';
        return;
    }
    
    // Clear loading state
    papersGrid.innerHTML = '';
    
    // Create year cards
    years.forEach(year => {
        const papers = papersDatabase[year];
        const yearCard = createYearCard(year, papers);
        papersGrid.appendChild(yearCard);
    });
}

// Create year card
function createYearCard(year, papers) {
    const card = document.createElement('div');
    card.className = 'year-card';
    
    const paperCount = papers.length;
    const paperPreview = papers.slice(0, 3); // Show first 3 papers
    
    card.innerHTML = `
        <div class="year-badge">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            ${year}
        </div>
        <h2>${year} Papers</h2>
        <p class="paper-count">${paperCount} paper${paperCount !== 1 ? 's' : ''} available</p>
        <div class="paper-list">
            ${paperPreview.map(paper => `
                <div class="paper-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5C15 5.53043 14.7893 6.03914 14.4142 6.41421C14.0391 6.78929 13.5304 7 13 7H11C10.4696 7 9.96086 6.78929 9.58579 6.41421C9.21071 6.03914 9 5.53043 9 5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${paper.title}
                </div>
            `).join('')}
            ${paperCount > 3 ? `<div class="paper-item">+ ${paperCount - 3} more...</div>` : ''}
        </div>
        <button class="view-papers-btn" onclick="viewYearPapers('${year}')">
            View ${year} Papers
        </button>
    `;
    
    return card;
}

// View papers for a specific year
window.viewYearPapers = function(year) {
    sessionStorage.setItem('selectedYear', year);
    window.location.href = `year-papers.html?subject=${subject}&year=${year}`;
};

// Handle sign out
signOutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        await firebaseAuth.signout();
        alert('You have been signed out successfully.');
        window.location.href = '../index.html';
    }
});

// Load papers on page load
setTimeout(() => {
    loadPapers();
}, 500);

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
