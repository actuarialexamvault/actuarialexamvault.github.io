// Check authentication with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { getPDFLink } from './pdf-links.js';

// Initialize activity monitor
initActivityMonitor();

// Initialize theme
themeManager.init();

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    } else {
        window.location.href = 'signin.html';
    }
});

// Custom Modal Functions
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

// Confirm modal with callback
function showConfirm(title, message, type = 'info', onConfirm = null, onCancel = null) {
    showModal(
        title,
        message,
        type,
        [
            { text: 'Yes', primary: true, callback: onConfirm },
            { text: 'No', primary: false, callback: onCancel }
        ]
    );
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('customModal');
    if (event.target === modal) {
        hideModal();
    }
});

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
    console.log('DOM Content Loaded - Initializing exam instructions page');
    
    // Set subject name
    const subjectNameEl = document.getElementById('subjectName');
    if (subjectTitle && subjectNameEl) {
        subjectNameEl.textContent = subjectTitle.toUpperCase();
    }
    
    // Set marks and credits info
    const totalMarksEl = document.getElementById('totalMarks');
    const creditsRequiredEl = document.getElementById('creditsRequired');
    
    if (totalMarksEl) {
        totalMarksEl.textContent = totalMarks;
    }
    
    if (creditsRequiredEl) {
        creditsRequiredEl.textContent = totalMarks + ' marking credits';
    }
    
    // Initialize timer display
    updateTimerDisplay();
    
    // Event listeners
    const startBtn = document.getElementById('startExamBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const uploadBtn = document.getElementById('uploadTemplateBtn');
    const fileInput = document.getElementById('templateFileInput');
    const signOutBtn = document.getElementById('signOutBtn');
    
    console.log('Initializing buttons...');
    console.log('Start button:', startBtn);
    console.log('Leave button:', leaveBtn);
    console.log('Upload button:', uploadBtn);
    console.log('Sign out button:', signOutBtn);
    
    if (startBtn) {
        console.log('Adding click listener to Start button');
        startBtn.addEventListener('click', startExam);
    } else {
        console.error('Start button NOT FOUND!');
    }
    
    if (leaveBtn) {
        console.log('Adding click listener to Leave button');
        leaveBtn.addEventListener('click', leaveExam);
    } else {
        console.error('Leave button NOT FOUND!');
    }
    
    // Download button is now a direct link, no event listener needed
    if (uploadBtn) uploadBtn.addEventListener('click', triggerFileUpload);
    if (fileInput) fileInput.addEventListener('change', handleTemplateUpload);
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);
    
    // Prevent navigation when exam is in progress
    window.addEventListener('beforeunload', preventNavigation);
});

function startExam() {
    console.log('startExam function called');
    console.log('examStarted:', examStarted);
    
    if (examStarted) {
        showModal(
            'Exam Already Started',
            'The exam has already been started. Please finish or leave the current exam first.',
            'info'
        );
        return;
    }
    
    // Get PDF link
    console.log('Getting PDF link for:', subject, session_type, year, paper);
    const pdfUrl = getPDFLink(subject, session_type, year, paper);
    console.log('PDF URL:', pdfUrl);
    
    if (!pdfUrl) {
        showModal(
            'Exam PDF Not Available',
            'The PDF for this exam could not be found.<br><br>' +
            'Please check the official past papers at:<br>' +
            '<a href="https://www.actuarialsociety.org.za/document-category/past-paper/" target="_blank">actuarialsociety.org.za/past-papers</a><br><br>' +
            'You may still proceed to start the timer once you have located and downloaded the exam paper from the official site. Use this option for Marking and tracking your progress.',
            'warning',
            [
                { text: 'Cancel', primary: false, callback: null },
                { text: 'Start Timer Anyway', primary: true, callback: () => startExamWithoutPDF() }
            ]
        );
        return;
    }
    
    // Confirm start
    showConfirm(
        'Start Exam',
        `You are about to start:<br><br>` +
        `<strong>${subjectTitle}</strong><br>` +
        `${session_type} ${year} - Paper ${paper}<br><br>` +
        `<strong>Duration:</strong> ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m<br>` +
        `<strong>Total Marks:</strong> ${totalMarks}<br><br>` +
        `The PDF will open in a new tab and the timer will start.<br><br>` +
        `Are you ready to begin?`,
        'info',
        function() {
            // User confirmed - start the exam
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
    );
}

// Start exam without PDF (user will use their own downloaded copy)
function startExamWithoutPDF() {
    if (examStarted) {
        showModal(
            'Exam Already Started',
            'The exam has already been started. Please finish or leave the current exam first.',
            'info'
        );
        return;
    }
    
    // Confirm start
    showConfirm(
        'Start Exam Timer',
        `You are about to start the timer for:<br><br>` +
        `<strong>${subjectTitle}</strong><br>` +
        `${session_type} ${year} - Paper ${paper}<br><br>` +
        `<strong>Duration:</strong> ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m<br>` +
        `<strong>Total Marks:</strong> ${totalMarks}<br><br>` +
        `Make sure you have the correct exam paper before starting the timer.<br><br>` +
        `Are you ready to begin?`,
        'info',
        function() {
            // User confirmed - start the exam timer
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
            startBtn.onclick = finishExam;
            
            // Start countdown timer
            timerInterval = setInterval(() => {
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
            
            showModal(
                'Timer Started',
                'The exam timer has started. Make sure you have your exam paper ready!',
                'success'
            );
        }
    );
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
    
    showModal(
        '⏰ Time\'s Up!',
        'Your exam time has expired.<br><br>' +
        'Please click <strong>"Finish Exam"</strong> to submit your work.',
        'warning'
    );
}

function finishExam() {
    showConfirm(
        'Finish Exam',
        'Are you sure you want to finish the exam?<br><br>' +
        'You will not be able to continue working on this paper after finishing.',
        'warning',
        function() {
            // User confirmed - finish the exam
            // Stop timer
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            
            // Mark exam as finished
            examStarted = false;
            
            // Update status
            document.getElementById('statusBadge').textContent = 'COMPLETED';
            document.getElementById('statusBadge').style.background = '#00d4aa';
            document.getElementById('statusBadge').style.color = 'white';
            
            // Hide finish button
            document.getElementById('startExamBtn').style.display = 'none';
            
            // Show upload button
            document.getElementById('uploadTemplateBtn').style.display = 'flex';
            
            // Clear exam state
            localStorage.removeItem('currentExam');
            
            // Show completion message
            showModal(
                '✓ Exam Completed!',
                'Upload the completed template using the <strong>"Upload My Attempt"</strong> button.',
                'success'
            );
        }
    );
}

function leaveExam() {
    console.log('leaveExam function called');
    console.log('examStarted:', examStarted);
    
    const title = examStarted ? 'Leave Exam' : 'Go Back';
    const message = examStarted 
        ? 'Are you sure you want to leave?<br><br><strong class="warning">Your progress will be lost</strong> and this attempt will not be accessible again.'
        : 'Are you sure you want to go back?';
    
    showConfirm(
        title,
        message,
        'warning',
        function() {
            // User confirmed - leave the exam
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            localStorage.removeItem('currentExam');
            window.location.href = `subject-papers.html?subject=${subject}&subjectTitle=${encodeURIComponent(subjectTitle)}`;
        }
    );
}

function downloadTemplate() {
    console.log('Download template button clicked');
    
    // Direct download approach - works better with local files
    const templatePath = '../templates/Exam practice template.docx';
    
    // Create custom filename with exam details if available
    let customFileName;
    if (subject && year && session_type && paper) {
        customFileName = `${subject}_${year}_${session_type}_Paper${paper}_AnswerTemplate.docx`;
    } else {
        customFileName = 'Exam_Practice_Template.docx';
    }
    
    console.log('Template path:', templatePath);
    console.log('Custom filename:', customFileName);
    console.log('Subject:', subject, 'Year:', year, 'Session:', session_type, 'Paper:', paper);
    
    // Create a direct download link
    const a = document.createElement('a');
    a.href = templatePath;
    a.download = customFileName;
    a.style.display = 'none';
    a.target = '_blank'; // Try opening in new tab if download fails
    document.body.appendChild(a);
    
    // Trigger download
    try {
        console.log('Attempting to trigger download...');
        a.click();
        console.log('Click triggered successfully');
        
        // Show success message after a brief delay
        setTimeout(() => {
            showModal(
                '✓ Download Started!',
                'File: <strong>' + customFileName + '</strong><br><br>' +
                '<strong>Instructions:</strong><br>' +
                '<ol style="text-align: left; margin: 0 auto; max-width: 400px;">' +
                '<li>Open the Word document</li>' +
                '<li>Fill in your exam details and answers</li>' +
                '<li>Save the completed document</li>' +
                '<li>Upload it after finishing the exam</li>' +
                '</ol><br>' +
                'If the download didn\'t start, check your Downloads folder.',
                'success'
            );
        }, 500);
    } catch (error) {
        console.error('Error downloading template:', error);
        showModal(
            '❌ Download Error',
            '<strong>Error:</strong> ' + error.message + '<br><br>' +
            'Please make sure:<br>' +
            '• The template file exists<br>' +
            '• You are running from a web server (localhost)<br>' +
            '• Your browser allows downloads<br><br>' +
            'Try manually copying the file from:<br>' +
            '<code>templates/Exam practice template.docx</code>',
            'error'
        );
    } finally {
        // Clean up after a delay
        setTimeout(() => {
            if (a.parentNode) {
                document.body.removeChild(a);
            }
        }, 1000);
    }
}

function triggerFileUpload() {
    document.getElementById('templateFileInput').click();
}

async function handleTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showModal(
            'File Too Large',
            'The file you selected is too large.<br><br>' +
            '<strong>Maximum file size:</strong> 10MB<br>' +
            '<strong>Your file size:</strong> ' + (file.size / 1024 / 1024).toFixed(2) + 'MB<br><br>' +
            'Please compress your file or choose a smaller file.',
            'error'
        );
        return;
    }
    
    // Create submission record
    const submission = {
        subject: subject,
        subjectTitle: subjectTitle,
        session: session_type,
        year: parseInt(year), // Ensure year is a number
        paper: paper,
        studentEmail: currentUser.email,
        fileName: file.name,
        fileSize: file.size,
        uploadTimestamp: new Date().toISOString(),
        uploadDate: new Date().toLocaleString(),
        status: 'submitted',
        timestamp: new Date().toISOString() // Add for progress tracker compatibility
    };
    
    console.log('Saving submission:', submission);
    
    // Store file in IndexedDB
    const uploadResult = await indexedDBStorage.storeFile(currentUser.uid, submission.uploadTimestamp, file);
    
    if (!uploadResult.success) {
        showModal('Upload Failed', 'Failed to store file locally. Please try again.', 'error');
        return;
    }
    
    // Add file info to submission (no URL needed for local storage)
    submission.fileStored = true;
    submission.fileId = uploadResult.fileId;
    submission.storedFileName = uploadResult.fileName;
    
    // Save submission metadata to Firestore
    const saveResult = await firestoreData.saveExamSubmission(
        currentUser.uid,
        submission.uploadTimestamp,
        submission
    );
    
    if (!saveResult.success) {
        showModal('Save Failed', 'Failed to save submission metadata. Please try again.', 'error');
        return;
    }
    
    // Show success modal
    showModal(
        '✓ Upload Successful!',
        '<strong>File:</strong> ' + file.name + '<br>' +
        '<strong>Upload Date:</strong> ' + submission.uploadDate + '<br>' +
        '<strong>Status:</strong> Submitted<br><br>' +
        'Your exam attempt has been saved and timestamped.<br>' +
        'Click Review to grade your attempt.',
        'success',
        [{
            text: 'Review',
            primary: true,
            callback: function() {
                // Reset file input
                event.target.value = '';
                
                // Navigate directly to exam-review page with exam details
                const reviewParams = new URLSearchParams({
                    subject: subject,
                    subjectTitle: subjectTitle,
                    session: session_type,
                    year: year,
                    paper: paper
                });
                window.location.href = 'exam-review.html?' + reviewParams.toString();
            }
        }]
    );
}

function preventNavigation(event) {
    if (examStarted && remainingSeconds > 0) {
        event.preventDefault();
        event.returnValue = 'You have an exam in progress. Your progress will be lost if you leave.';
        return event.returnValue;
    }
}

function signOut() {
    if (examStarted && remainingSeconds > 0) {
        showModal(
            'Cannot Sign Out',
            'You cannot sign out while an exam is in progress.<br><br>' +
            'Please <strong>finish</strong> or <strong>leave</strong> the exam first.',
            'warning'
        );
        return;
    }
    
    showConfirm(
        'Sign Out',
        'Are you sure you want to sign out?',
        'info',
        async function() {
            // User confirmed - sign out
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            localStorage.removeItem('currentExam');
            await firebaseAuth.signout();
            window.location.href = '../index.html';
        }
    );
}

// Override navigation links to prevent leaving during exam
function preventNavDuringExam(event) {
    if (examStarted && remainingSeconds > 0) {
        event.preventDefault();
        showModal(
            'Exam in Progress',
            'You cannot navigate away while an exam is in progress.<br><br>' +
            'Please <strong>finish</strong> or <strong>leave</strong> the exam first.',
            'warning'
        );
        return false;
    }
    return true;
}

// Add navigation protection after page load
window.addEventListener('load', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', preventNavDuringExam);
    });
});

// Function to view all submissions (can be called from dashboard)
function viewSubmissions() {
    const submissions = JSON.parse(localStorage.getItem('examSubmissions') || '[]');
    const userSubmissions = submissions.filter(s => s.studentEmail === session.email);
    
    if (userSubmissions.length === 0) {
        showModal(
            'No Submissions',
            'You haven\'t submitted any exams yet.<br><br>' +
            'Complete an exam and upload your answers to see them here.',
            'info'
        );
        return;
    }
    
    let message = '<strong>YOUR EXAM SUBMISSIONS:</strong><br><br>';
    message += '<div style="text-align: left; max-width: 500px; margin: 0 auto;">';
    userSubmissions.forEach((sub, index) => {
        message += `<div style="margin-bottom: 1rem; padding: 0.5rem; background: #f5f5f5; border-radius: 6px;">`;
        message += `<strong>${index + 1}. ${sub.subjectTitle}</strong><br>`;
        message += `${sub.session} ${sub.year} - Paper ${sub.paper}<br>`;
        message += `<small>Uploaded: ${sub.uploadDate}</small><br>`;
        message += `<small>File: ${sub.fileName}</small><br>`;
        message += `<small>Status: <strong>${sub.status}</strong></small>`;
        message += `</div>`;
    });
    message += '</div>';
    
    showModal('Your Submissions', message, 'info');
}

// Make viewSubmissions available globally
window.viewSubmissions = viewSubmissions;

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
            
            showConfirm(
                'Resume Exam',
                'You have an exam in progress for this paper.<br><br>' +
                'Would you like to continue where you left off?',
                'info',
                function() {
                    // User confirmed - resume exam
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
                    showModal(
                        'Exam Expired',
                        'The time for this exam has expired.<br><br>' +
                        'Please start a new attempt.',
                        'error'
                    );
                }
                },
                function() {
                    // User declined - remove saved exam
                    localStorage.removeItem('currentExam');
                }
            );
        }
    }
});
