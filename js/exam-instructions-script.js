// Check authentication
const authManager = new AuthManager();
const session = authManager.getSession();

if (!session) {
    window.location.href = 'signin.html';
}

// Get paper details from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject');
const subjectTitle = urlParams.get('subjectTitle');
const session_type = urlParams.get('session');
const year = urlParams.get('year');
const paper = urlParams.get('paper');

// Calculate exam duration (100 marks as default, can be customized per subject)
const totalMarks = 100;
const readingTime = 15; // minutes
const timePerMark = 1.8; // minutes
const totalMinutes = Math.floor(totalMarks * timePerMark) + readingTime;

let timerInterval = null;
let remainingSeconds = totalMinutes * 60;
let examStarted = false;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set subject name
    if (subjectTitle) {
        document.getElementById('subjectName').textContent = subjectTitle.toUpperCase();
    }
    
    // Set marks and credits info
    document.getElementById('totalMarks').textContent = totalMarks;
    document.getElementById('creditsRequired').textContent = totalMarks + ' marking credits';
    
    // Initialize timer display
    updateTimerDisplay();
    
    // Event listeners
    document.getElementById('startExamBtn').addEventListener('click', startExam);
    document.getElementById('leaveBtn').addEventListener('click', leaveExam);
    document.getElementById('hideBtn').addEventListener('click', hideExam);
    document.getElementById('creditsBtn').addEventListener('click', showCredits);
    document.getElementById('signOutBtn').addEventListener('click', signOut);
});

function startExam() {
    if (examStarted) {
        alert('Exam already started!');
        return;
    }
    
    // Get PDF link
    const pdfUrl = getPDFLink(subject, session_type, year, paper);
    
    if (!pdfUrl) {
        alert('PDF not available for this paper. Please contact support.');
        return;
    }
    
    // Confirm start
    const confirmed = confirm(
        `You are about to start:\n\n` +
        `${subjectTitle}\n` +
        `${session_type} ${year} - Paper ${paper}\n\n` +
        `Duration: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m\n` +
        `Total Marks: ${totalMarks}\n\n` +
        `The PDF will open in a new tab and the timer will start.\n\n` +
        `Are you ready to begin?`
    );
    
    if (!confirmed) {
        return;
    }
    
    // Open PDF in new tab
    window.open(pdfUrl, '_blank');
    
    // Start timer
    examStarted = true;
    document.getElementById('statusBadge').textContent = 'IN_PROGRESS';
    document.getElementById('statusBadge').classList.add('in-progress');
    
    // Change start button to finish button
    const startBtn = document.getElementById('startExamBtn');
    startBtn.textContent = 'Finish Exam';
    startBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Finish Exam
    `;
    startBtn.removeEventListener('click', startExam);
    startBtn.addEventListener('click', finishExam);
    
    // Start countdown
    timerInterval = setInterval(function() {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            remainingSeconds = 0;
            timeUp();
        }
        
        updateTimerDisplay();
    }, 1000);
    
    // Store exam state in localStorage
    const examState = {
        subject,
        subjectTitle,
        session: session_type,
        year,
        paper,
        startTime: new Date().toISOString(),
        remainingSeconds,
        totalMarks
    };
    
    localStorage.setItem('currentExam', JSON.stringify(examState));
}

function updateTimerDisplay() {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    
    const timerText = `${hours}h ${minutes}m ${seconds}s`;
    document.getElementById('timerDisplay').textContent = timerText;
    
    // Change color if time is running low
    const timerDisplay = document.getElementById('timerDisplay');
    if (remainingSeconds < 600) { // Less than 10 minutes
        timerDisplay.style.color = '#ff4444';
    } else if (remainingSeconds < 1800) { // Less than 30 minutes
        timerDisplay.style.color = '#ff9800';
    } else {
        timerDisplay.style.color = '#00a3ff';
    }
}

function timeUp() {
    document.getElementById('statusBadge').textContent = 'TIME_UP';
    document.getElementById('statusBadge').style.background = '#ff4444';
    document.getElementById('statusBadge').style.color = 'white';
    
    alert(
        '⏰ TIME\'S UP! ⏰\n\n' +
        'Your exam time has expired.\n' +
        'Please click "Finish Exam" to submit your work.'
    );
}

function finishExam() {
    const confirmed = confirm(
        'Are you sure you want to finish the exam?\n\n' +
        'You will not be able to continue working on this paper after finishing.'
    );
    
    if (!confirmed) {
        return;
    }
    
    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Clear exam state
    localStorage.removeItem('currentExam');
    
    // Show completion message
    alert(
        '✓ Exam Completed!\n\n' +
        'Your exam has been saved.\n' +
        'You can now choose to mark it yourself or submit for professional marking.'
    );
    
    // Navigate back to subject papers page
    window.location.href = `subject-papers.html?subject=${subject}&subjectTitle=${encodeURIComponent(subjectTitle)}`;
}

function leaveExam() {
    const message = examStarted 
        ? 'Are you sure you want to leave?\n\nYour progress will be lost and this attempt will not be accessible again.'
        : 'Are you sure you want to leave?';
    
    const confirmed = confirm(message);
    
    if (confirmed) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        localStorage.removeItem('currentExam');
        window.location.href = `subject-papers.html?subject=${subject}&subjectTitle=${encodeURIComponent(subjectTitle)}`;
    }
}

function hideExam() {
    alert('Hide functionality: This would minimize the exam window. (To be implemented)');
}

function showCredits() {
    alert(
        'Marking Credits Information:\n\n' +
        '• This paper requires ' + totalMarks + ' marking credits\n' +
        '• Professional marking provides detailed feedback\n' +
        '• Self-marking is free but requires manual review\n\n' +
        'Purchase credits from your account page.'
    );
}

function signOut() {
    const confirmed = confirm('Are you sure you want to sign out?');
    if (confirmed) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        localStorage.removeItem('currentExam');
        authManager.signOut();
        window.location.href = '../index.html';
    }
}

// Check for existing exam state on page load
window.addEventListener('load', function() {
    const savedExam = localStorage.getItem('currentExam');
    if (savedExam) {
        const examData = JSON.parse(savedExam);
        
        // Check if it's the same paper
        if (examData.subject === subject && 
            examData.session === session_type && 
            examData.year === year && 
            examData.paper === paper) {
            
            const confirmed = confirm(
                'You have an exam in progress for this paper.\n\n' +
                'Would you like to continue where you left off?'
            );
            
            if (confirmed) {
                // Calculate remaining time
                const startTime = new Date(examData.startTime);
                const now = new Date();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                remainingSeconds = examData.remainingSeconds - elapsedSeconds;
                
                if (remainingSeconds > 0) {
                    // Resume exam
                    examStarted = true;
                    document.getElementById('statusBadge').textContent = 'IN_PROGRESS';
                    document.getElementById('statusBadge').classList.add('in-progress');
                    
                    const startBtn = document.getElementById('startExamBtn');
                    startBtn.textContent = 'Finish Exam';
                    startBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Finish Exam
                    `;
                    startBtn.removeEventListener('click', startExam);
                    startBtn.addEventListener('click', finishExam);
                    
                    // Start countdown from remaining time
                    timerInterval = setInterval(function() {
                        remainingSeconds--;
                        
                        if (remainingSeconds <= 0) {
                            clearInterval(timerInterval);
                            remainingSeconds = 0;
                            timeUp();
                        }
                        
                        updateTimerDisplay();
                    }, 1000);
                    
                    updateTimerDisplay();
                } else {
                    // Time already expired
                    localStorage.removeItem('currentExam');
                    alert('The time for this exam has expired.');
                }
            } else {
                localStorage.removeItem('currentExam');
            }
        }
    }
});
