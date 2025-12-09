// Year papers page functionality
const authManager = new AuthManager();

const signOutBtn = document.getElementById('signOutBtn');
const yearTitle = document.getElementById('yearTitle');
const subjectSubtitle = document.getElementById('subjectSubtitle');
const paperItemsList = document.getElementById('paperItemsList');

// Check if user is logged in
const session = authManager.getSession();
if (!session) {
    alert('Please sign in to access past papers.');
    window.location.href = 'signin.html';
}

// Get parameters
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const year = urlParams.get('year') || sessionStorage.getItem('selectedYear');
const subjectTitleText = sessionStorage.getItem('selectedSubjectTitle');

if (!subject || !year) {
    window.location.href = 'subjects.html';
}

// Update titles
yearTitle.textContent = `${year} Past Papers`;
if (subjectTitleText) {
    subjectSubtitle.textContent = `${subjectTitleText} - ${year}`;
}

// Papers database
const papersDatabase = {
    '2016': [
        { file: '2016_June_PaperA_Q1.md', title: 'June Paper A - Question 1', session: 'June', paper: 'Paper A', question: 1 },
        { file: '2016_June_PaperA_Q2.md', title: 'June Paper A - Question 2', session: 'June', paper: 'Paper A', question: 2 },
        { file: '2016_June_PaperA_Q3.md', title: 'June Paper A - Question 3', session: 'June', paper: 'Paper A', question: 3 },
        { file: '2016_June_PaperA_Q4.md', title: 'June Paper A - Question 4', session: 'June', paper: 'Paper A', question: 4 },
        { file: '2016_June_PaperA_Q5.md', title: 'June Paper A - Question 5', session: 'June', paper: 'Paper A', question: 5 },
        { file: '2016_June_PaperA_Q6.md', title: 'June Paper A - Question 6', session: 'June', paper: 'Paper A', question: 6 },
        { file: '2016_June_PaperA_Q7.md', title: 'June Paper A - Question 7', session: 'June', paper: 'Paper A', question: 7 },
        { file: '2016_June_PaperA_Q8.md', title: 'June Paper A - Question 8', session: 'June', paper: 'Paper A', question: 8 },
        { file: '2016_June_PaperB_Q1.md', title: 'June Paper B - Question 1', session: 'June', paper: 'Paper B', question: 1 },
        { file: '2016_June_PaperB_Q2.md', title: 'June Paper B - Question 2', session: 'June', paper: 'Paper B', question: 2 },
        { file: '2016_June_PaperB_Q3.md', title: 'June Paper B - Question 3', session: 'June', paper: 'Paper B', question: 3 },
        { file: '2016_June_PaperB_Q4.md', title: 'June Paper B - Question 4', session: 'June', paper: 'Paper B', question: 4 },
        { file: '2016_June_PaperB_Q5.md', title: 'June Paper B - Question 5', session: 'June', paper: 'Paper B', question: 5 },
        { file: '2016_June_PaperB_Q6.md', title: 'June Paper B - Question 6', session: 'June', paper: 'Paper B', question: 6 },
        { file: '2016_June_PaperB_Q7.md', title: 'June Paper B - Question 7', session: 'June', paper: 'Paper B', question: 7 },
        { file: '2016_June_PaperB_Q8.md', title: 'June Paper B - Question 8', session: 'June', paper: 'Paper B', question: 8 },
        { file: '2016_June_PaperB_Q9.md', title: 'June Paper B - Question 9', session: 'June', paper: 'Paper B', question: 9 },
        { file: 'Oct_2016_Paper2_Q4.md', title: 'October Paper 2 - Question 4', session: 'October', paper: 'Paper 2', question: 4 }
    ],
    '2017': [
        { file: 'May_2017_Paper2_Q4.md', title: 'May Paper 2 - Question 4', session: 'May', paper: 'Paper 2', question: 4 },
        { file: 'May_2017_Paper2_Q8.md', title: 'May Paper 2 - Question 8', session: 'May', paper: 'Paper 2', question: 8 }
    ],
    '2019': [
        { file: 'May_2019_Paper2_Q9.md', title: 'May Paper 2 - Question 9', session: 'May', paper: 'Paper 2', question: 9 },
        { file: 'Oct_2019_Paper2_Q4.md', title: 'October Paper 2 - Question 4', session: 'October', paper: 'Paper 2', question: 4 }
    ],
    '2020': [
        { file: 'May_2020_Paper1_Q2.md', title: 'May Paper 1 - Question 2', session: 'May', paper: 'Paper 1', question: 2 }
    ],
    '2022': [
        { file: '2022_June_Paper1_Q1.md', title: 'June Paper 1 - Question 1', session: 'June', paper: 'Paper 1', question: 1 },
        { file: '2022_June_Paper1_Q2.md', title: 'June Paper 1 - Question 2', session: 'June', paper: 'Paper 1', question: 2 },
        { file: '2022_June_Paper1_Q3.md', title: 'June Paper 1 - Question 3', session: 'June', paper: 'Paper 1', question: 3 },
        { file: '2022_June_Paper1_Q4.md', title: 'June Paper 1 - Question 4', session: 'June', paper: 'Paper 1', question: 4 },
        { file: '2022_June_Paper1_Q5.md', title: 'June Paper 1 - Question 5', session: 'June', paper: 'Paper 1', question: 5 },
        { file: '2022_June_Paper1_Q6.md', title: 'June Paper 1 - Question 6', session: 'June', paper: 'Paper 1', question: 6 },
        { file: '2022_June_Paper1_Q7.md', title: 'June Paper 1 - Question 7', session: 'June', paper: 'Paper 1', question: 7 },
        { file: '2022_June_Paper1_Q8.md', title: 'June Paper 1 - Question 8', session: 'June', paper: 'Paper 1', question: 8 },
        { file: '2022_June_Paper2_Q1.md', title: 'June Paper 2 - Question 1', session: 'June', paper: 'Paper 2', question: 1 },
        { file: '2022_June_Paper2_Q2.md', title: 'June Paper 2 - Question 2', session: 'June', paper: 'Paper 2', question: 2 },
        { file: '2022_June_Paper2_Q3.md', title: 'June Paper 2 - Question 3', session: 'June', paper: 'Paper 2', question: 3 },
        { file: '2022_June_Paper2_Q4.md', title: 'June Paper 2 - Question 4', session: 'June', paper: 'Paper 2', question: 4 },
        { file: '2022_June_Paper2_Q5.md', title: 'June Paper 2 - Question 5', session: 'June', paper: 'Paper 2', question: 5 },
        { file: '2022_June_Paper2_Q6.md', title: 'June Paper 2 - Question 6', session: 'June', paper: 'Paper 2', question: 6 },
        { file: '2022_June_Paper2_Q7.md', title: 'June Paper 2 - Question 7', session: 'June', paper: 'Paper 2', question: 7 },
        { file: '2022_June_Paper2_Q8.md', title: 'June Paper 2 - Question 8', session: 'June', paper: 'Paper 2', question: 8 },
        { file: '2022_November_Paper1_Q1.md', title: 'November Paper 1 - Question 1', session: 'November', paper: 'Paper 1', question: 1 },
        { file: '2022_November_Paper1_Q2.md', title: 'November Paper 1 - Question 2', session: 'November', paper: 'Paper 1', question: 2 },
        { file: '2022_November_Paper1_Q3.md', title: 'November Paper 1 - Question 3', session: 'November', paper: 'Paper 1', question: 3 },
        { file: '2022_November_Paper1_Q4.md', title: 'November Paper 1 - Question 4', session: 'November', paper: 'Paper 1', question: 4 },
        { file: '2022_November_Paper1_Q5.md', title: 'November Paper 1 - Question 5', session: 'November', paper: 'Paper 1', question: 5 },
        { file: '2022_November_Paper1_Q6.md', title: 'November Paper 1 - Question 6', session: 'November', paper: 'Paper 1', question: 6 },
        { file: '2022_November_Paper1_Q7.md', title: 'November Paper 1 - Question 7', session: 'November', paper: 'Paper 1', question: 7 },
        { file: '2022_November_Paper1_Q8.md', title: 'November Paper 1 - Question 8', session: 'November', paper: 'Paper 1', question: 8 },
        { file: '2022_November_Paper2_Q1.md', title: 'November Paper 2 - Question 1', session: 'November', paper: 'Paper 2', question: 1 },
        { file: '2022_November_Paper2_Q2.md', title: 'November Paper 2 - Question 2', session: 'November', paper: 'Paper 2', question: 2 },
        { file: '2022_November_Paper2_Q3.md', title: 'November Paper 2 - Question 3', session: 'November', paper: 'Paper 2', question: 3 },
        { file: '2022_November_Paper2_Q4.md', title: 'November Paper 2 - Question 4', session: 'November', paper: 'Paper 2', question: 4 },
        { file: '2022_November_Paper2_Q5.md', title: 'November Paper 2 - Question 5', session: 'November', paper: 'Paper 2', question: 5 },
        { file: '2022_November_Paper2_Q6.md', title: 'November Paper 2 - Question 6', session: 'November', paper: 'Paper 2', question: 6 },
        { file: '2022_November_Paper2_Q7.md', title: 'November Paper 2 - Question 7', session: 'November', paper: 'Paper 2', question: 7 },
        { file: '2022_November_Paper2_Q8.md', title: 'November Paper 2 - Question 8', session: 'November', paper: 'Paper 2', question: 8 }
    ],
    '2023': [
        { file: '2023_June_Paper1_Q1.md', title: 'June Paper 1 - Question 1', session: 'June', paper: 'Paper 1', question: 1 },
        { file: '2023_June_Paper1_Q2.md', title: 'June Paper 1 - Question 2', session: 'June', paper: 'Paper 1', question: 2 },
        { file: '2023_June_Paper1_Q3.md', title: 'June Paper 1 - Question 3', session: 'June', paper: 'Paper 1', question: 3 },
        { file: '2023_June_Paper1_Q4.md', title: 'June Paper 1 - Question 4', session: 'June', paper: 'Paper 1', question: 4 },
        { file: '2023_June_Paper1_Q5.md', title: 'June Paper 1 - Question 5', session: 'June', paper: 'Paper 1', question: 5 },
        { file: '2023_June_Paper1_Q6.md', title: 'June Paper 1 - Question 6', session: 'June', paper: 'Paper 1', question: 6 },
        { file: '2023_June_Paper1_Q7.md', title: 'June Paper 1 - Question 7', session: 'June', paper: 'Paper 1', question: 7 },
        { file: '2023_June_Paper2_Q1.md', title: 'June Paper 2 - Question 1', session: 'June', paper: 'Paper 2', question: 1 },
        { file: '2023_June_Paper2_Q2.md', title: 'June Paper 2 - Question 2', session: 'June', paper: 'Paper 2', question: 2 }
    ]
};

// Load papers for the year
function loadYearPapers() {
    const papers = papersDatabase[year] || [];
    
    paperItemsList.innerHTML = '';
    
    if (papers.length === 0) {
        paperItemsList.innerHTML = `
            <div class="no-papers">
                <p>No papers found for ${year}</p>
            </div>
        `;
        return;
    }
    
    // Group by session and paper
    const grouped = {};
    papers.forEach(paper => {
        const key = `${paper.session} ${paper.paper}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(paper);
    });
    
    // Create list
    Object.keys(grouped).sort().forEach(groupKey => {
        const groupPapers = grouped[groupKey];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'paper-group';
        
        groupDiv.innerHTML = `
            <h3 class="group-title">${groupKey}</h3>
            <div class="paper-items">
                ${groupPapers.map(paper => `
                    <div class="paper-item-card" onclick="openPaper('${year}', '${paper.file}')">
                        <div class="paper-item-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="paper-item-content">
                            <h4>Question ${paper.question}</h4>
                            <p>${paper.file}</p>
                        </div>
                        <div class="paper-item-arrow">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        paperItemsList.appendChild(groupDiv);
    });
}

// Open paper file
window.openPaper = function(year, filename) {
    const filepath = `past_papers/${year}/${filename}`;
    alert(`Opening paper: ${filepath}\n\nIn a full implementation, this would open the markdown file for viewing and studying.`);
    // In production, you would open the file in a viewer or navigate to a paper view page
};

// Handle sign out
signOutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (confirm('Are you sure you want to sign out?')) {
        authManager.signOut();
        alert('You have been signed out successfully.');
        window.location.href = '../index.html';
    }
});

// Load papers
setTimeout(() => {
    loadYearPapers();
}, 500);

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
