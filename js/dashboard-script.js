// Dashboard functionality with Firebase
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';

const userName = document.getElementById('userName');
const userNameTitle = document.getElementById('userNameTitle');
const signOutBtn = document.getElementById('signOutBtn');
const continueSection = document.getElementById('continueSection');
const continueCard = document.getElementById('continueCard');
const continueSubject = document.getElementById('continueSubject');
const themeToggle = document.getElementById('themeToggle');

// Theme management
function initTheme(user) {
    // Load theme preference from Firebase
    themeManager.init();
    
    // Add theme toggle event listener
    themeToggle.addEventListener('click', () => {
        themeManager.toggleTheme(user);
    });
}

// Check if user is logged in and load profile
async function checkAuthAndLoadProfile() {
    const user = firebaseAuth.getCurrentUser();
    
    if (!user) {
        // Wait a moment for Firebase to initialize
        setTimeout(async () => {
            const retryUser = firebaseAuth.getCurrentUser();
            if (!retryUser) {
                alert('Please sign in to access the dashboard.');
                window.location.href = 'signin.html';
            } else {
                await loadUserProfile(retryUser);
                initTheme(retryUser);
            }
        }, 1000);
    } else {
        await loadUserProfile(user);
        initTheme(user);
    }
}

async function loadUserProfile(user) {
    // Get user profile from Firestore
    const result = await firestoreData.getUserProfile(user.uid);
    
    if (result.success && result.data) {
        // Display only first name (prefer 'name' field, fallback to splitting 'fullname')
        let displayName;
        if (result.data.name) {
            displayName = result.data.name;
        } else if (result.data.fullname) {
            // For legacy users, extract first name from fullname
            displayName = result.data.fullname.split(' ')[0];
        } else {
            // Final fallback to email
            displayName = user.email;
        }
        
        userName.textContent = displayName;
        userNameTitle.textContent = displayName;
    } else {
        // Fallback to email if no profile data
        userName.textContent = user.email;
        userNameTitle.textContent = user.email;
    }
    
    // Load continue section
    await loadContinueSection(user);
    
    // Load analytics if user has a primary exam
    await loadAnalytics(user);
}

async function loadContinueSection(user) {
    // Get last accessed subject and chapter from sessionStorage
    let lastSubject = sessionStorage.getItem('selectedSubject');
    let lastSubjectTitle = sessionStorage.getItem('selectedSubjectTitle');
    let lastChapter = sessionStorage.getItem('selectedChapter');
    
    // If not in session, try to get from recent submissions
    if (!lastSubject) {
        const submissions = await firestoreData.getExamSubmissions(user.uid);
        if (submissions.success && submissions.data) {
            const submissionsArray = Object.values(submissions.data);
            if (submissionsArray.length > 0) {
                // Sort by timestamp and get most recent
                const sorted = submissionsArray.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                lastSubject = sorted[0].subject;
                lastSubjectTitle = `${lastSubject}: Continue practicing`;
            }
        }
    }
    
    // Show continue section if we have a last subject
    if (lastSubject) {
        // Determine the display text based on whether we have chapter info
        if (lastChapter) {
            continueSubject.textContent = `${lastSubjectTitle || lastSubject}: ${lastChapter}`;
        } else {
            continueSubject.textContent = lastSubjectTitle || `${lastSubject}: View your progress`;
        }
        
        continueSection.style.display = 'block';
        
        // Add click handler to navigate to appropriate page
        continueCard.addEventListener('click', (e) => {
            e.preventDefault();
            
            // If user was viewing chapter questions, go back to that chapter
            if (lastChapter) {
                window.location.href = `chapter-questions.html?subject=${encodeURIComponent(lastSubject)}&chapter=${encodeURIComponent(lastChapter)}`;
            } else {
                // Otherwise, go to progress tracker
                sessionStorage.setItem('autoShowSubject', lastSubject);
                sessionStorage.setItem('autoShowSubjectTitle', lastSubjectTitle || lastSubject);
                window.location.href = 'progress-tracker.html';
            }
        });
    }
}

// Load and calculate analytics
async function loadAnalytics(user) {
    try {
        // Get user profile to check for primary exam
        const profileResult = await firestoreData.getUserProfile(user.uid);
        const primaryExam = profileResult.success && profileResult.data && profileResult.data.primaryExam;
        
        console.log('Primary exam:', primaryExam);
        
        // Only show analytics if user has set a primary exam
        if (!primaryExam) {
            console.log('No primary exam set');
            return;
        }
        
        // Show analytics section
        const analyticsSection = document.getElementById('analyticsSection');
        if (analyticsSection) {
            analyticsSection.style.display = 'block';
        }
        
        // Get all grades for the primary exam (returns array directly)
        const allGrades = await firestoreData.getQuestionGrades(user.uid);
        console.log('Grades result:', allGrades);
        
        if (!allGrades || allGrades.length === 0) {
            console.log('No grades data available');
            updateAnalyticsWithEmptyState();
            return;
        }
        
        console.log('All grades:', allGrades.length, 'grades found');
        
        const examGrades = allGrades.filter(grade => grade.subject === primaryExam);
        console.log('Filtered grades for', primaryExam, ':', examGrades.length, 'grades found');
        
        // Debug: Log first few grades to see their structure
        console.log('Sample F102 grades:', examGrades.slice(0, 3).map(g => ({
            subject: g.subject,
            chapter: g.chapter,
            year: g.year,
            session: g.session,
            paper: g.paper,
            question: g.question
        })));
        
        // Check if ANY grades have chapter field
        const gradesWithChapter = examGrades.filter(g => g.chapter);
        console.log('Grades with chapter field:', gradesWithChapter.length);
        if (gradesWithChapter.length > 0) {
            console.log('Sample chapter grades:', gradesWithChapter.slice(0, 2));
        }
        
        if (examGrades.length === 0) {
            // No data yet - show empty state
            console.log('No grades for primary exam, showing empty state');
            updateAnalyticsWithEmptyState();
            return;
        }
        
        // Calculate analytics
        console.log('Calculating analytics with', examGrades.length, 'grades');
        calculateExamReadiness(examGrades, primaryExam);
        calculateWeakTopics(examGrades, primaryExam);
        calculateWeakExams(examGrades, primaryExam);
        await calculateStudyHabits(examGrades, user);
        
        // Set up View All Papers link with primary subject
        const viewAllPapersLink = document.getElementById('viewAllPapersLink');
        if (viewAllPapersLink && primaryExam) {
            viewAllPapersLink.href = `progress-tracker.html?subject=${encodeURIComponent(primaryExam)}`;
        }
        
        // Calculate study plan countdown
        await calculateStudyPlan(user);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        updateAnalyticsWithEmptyState();
    }
}

// Calculate Exam Readiness Score
function calculateExamReadiness(grades, subject) {
    // Calculate average score
    const averageScore = grades.reduce((sum, g) => {
        const percentage = g.maxMarks > 0 ? (g.marks / g.maxMarks) * 100 : 0;
        return sum + percentage;
    }, 0) / grades.length;
    
    // Get unique chapters attempted
    const chaptersAttempted = new Set();
    grades.forEach(g => {
        if (g.chapter) chaptersAttempted.add(g.chapter);
    });
    
    // Estimate total chapters (F102 has 12 chapters based on chapter_map)
    const totalChapters = 12;
    const chapterCoverage = (chaptersAttempted.size / totalChapters) * 100;
    
    // Calculate improvement trend (last 5 vs previous 5 attempts)
    let improvementTrend = 0;
    if (grades.length >= 5) {
        const sortedGrades = [...grades].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        const recent5 = sortedGrades.slice(0, 5);
        const previous5 = sortedGrades.slice(5, 10);
        
        if (previous5.length > 0) {
            const recentAvg = recent5.reduce((sum, g) => 
                sum + (g.maxMarks > 0 ? (g.marks / g.maxMarks) * 100 : 0), 0) / recent5.length;
            const previousAvg = previous5.reduce((sum, g) => 
                sum + (g.maxMarks > 0 ? (g.marks / g.maxMarks) * 100 : 0), 0) / previous5.length;
            
            improvementTrend = recentAvg - previousAvg;
        }
    }
    
    // Calculate projected exam score based on full exam attempts (2018-2025)
    let projectedExamScore = averageScore;
    const fullExamGrades = grades.filter(g => {
        if (!g.year || !g.paper) return false;
        const year = parseInt(g.year);
        return year >= 2018 && year <= 2025;
    });
    
    if (fullExamGrades.length > 0) {
        // Group by exam to get overall exam scores
        const examScores = {};
        fullExamGrades.forEach(g => {
            const examKey = `${g.year}-${g.session}`;
            if (!examScores[examKey]) {
                examScores[examKey] = { totalMarks: 0, totalMaxMarks: 0 };
            }
            examScores[examKey].totalMarks += g.marks || 0;
            examScores[examKey].totalMaxMarks += g.maxMarks || 0;
        });
        
        // Calculate overall percentage for each exam and sort by timestamp
        const examResults = Object.entries(examScores).map(([key, data]) => ({
            percentage: data.totalMaxMarks > 0 ? (data.totalMarks / data.totalMaxMarks) * 100 : 0
        }));
        
        if (examResults.length >= 3) {
            // Calculate trend from recent exams
            const recentExams = examResults.slice(-3);
            const olderExams = examResults.slice(-6, -3);
            
            if (olderExams.length > 0) {
                const recentAvg = recentExams.reduce((sum, e) => sum + e.percentage, 0) / recentExams.length;
                const olderAvg = olderExams.reduce((sum, e) => sum + e.percentage, 0) / olderExams.length;
                const examTrend = recentAvg - olderAvg;
                
                // Project forward by 3 more exams
                projectedExamScore = Math.round(recentAvg + (examTrend * 1));
            } else {
                projectedExamScore = Math.round(recentExams.reduce((sum, e) => sum + e.percentage, 0) / recentExams.length);
            }
        } else if (examResults.length > 0) {
            // Not enough data for trend, use average
            projectedExamScore = Math.round(examResults.reduce((sum, e) => sum + e.percentage, 0) / examResults.length);
        }
    }
    projectedExamScore = Math.max(0, Math.min(100, projectedExamScore)); // Clamp between 0-100
    
    // Calculate weighted readiness score
    // 50% average score + 45% chapter coverage + 5% improvement trend (0-100 scale)
    const normalizedImprovement = Math.max(0, Math.min(100, 50 + improvementTrend * 5));
    const readinessScore = Math.round(
        (averageScore * 0.5) + (chapterCoverage * 0.45) + (normalizedImprovement * 0.05)
    );
    
    // Determine status
    let status = '';
    let statusColor = '';
    if (readinessScore < 50) {
        status = 'Getting Started';
        statusColor = '#dc2626';
    } else if (readinessScore < 70) {
        status = 'Building Confidence';
        statusColor = '#f59e0b';
    } else if (readinessScore < 85) {
        status = 'Approaching Ready';
        statusColor = '#f97316';
    } else {
        status = 'Exam Ready!';
        statusColor = '#10b981';
    }
    
    // Update UI
    const scoreValue = document.getElementById('scoreValue');
    const scoreStatus = document.getElementById('scoreStatus');
    const readinessProgress = document.getElementById('readinessProgress');
    const chaptersCompleted = document.getElementById('chaptersCompleted');
    const improvementTrendEl = document.getElementById('improvementTrend');
    const projectedScoreEl = document.getElementById('projectedScore');
    
    if (scoreValue) scoreValue.textContent = `${readinessScore}%`;
    if (scoreStatus) {
        scoreStatus.textContent = status;
        scoreStatus.style.color = statusColor;
    }
    if (readinessProgress) readinessProgress.style.width = `${readinessScore}%`;
    if (chaptersCompleted) chaptersCompleted.textContent = `${chaptersAttempted.size}/${totalChapters} chapters practiced`;
    
    if (improvementTrendEl) {
        const trendSymbol = improvementTrend > 0 ? '↗' : improvementTrend < 0 ? '↘' : '→';
        const trendText = improvementTrend > 0 ? 'improvement' : improvementTrend < 0 ? 'decline' : 'stable';
        improvementTrendEl.textContent = `${trendSymbol} ${Math.abs(Math.round(improvementTrend))}% ${trendText}`;
    }
    
    // Update projected exam score
    if (projectedScoreEl) {
        projectedScoreEl.textContent = `Projected: ${projectedExamScore}%`;
        // Color code based on pass threshold
        if (projectedExamScore >= 70) {
            projectedScoreEl.style.color = '#10b981';
        } else if (projectedExamScore >= 50) {
            projectedScoreEl.style.color = '#f59e0b';
        } else {
            projectedScoreEl.style.color = '#dc2626';
        }
    }
}

// Calculate Weak Topics (Chapter-based practice)
function calculateWeakTopics(grades, subject) {
    console.log('calculateWeakTopics - Input:', grades.length, 'grades');
    
    // Filter only grades with chapter information
    const chapterGrades = grades.filter(grade => grade.chapter);
    console.log('Chapter-based grades found:', chapterGrades.length);
    
    // Group grades by chapter
    const chapterScores = {};
    
    chapterGrades.forEach(grade => {
        if (!chapterScores[grade.chapter]) {
            chapterScores[grade.chapter] = {
                totalMarks: 0,
                totalMaxMarks: 0,
                attempts: 0,
                name: grade.chapter
            };
        }
        
        chapterScores[grade.chapter].totalMarks += grade.marks || 0;
        chapterScores[grade.chapter].totalMaxMarks += grade.maxMarks || 0;
        chapterScores[grade.chapter].attempts++;
    });
    
    console.log('Grouped chapters:', Object.keys(chapterScores).length, chapterScores);
    
    // Calculate averages and sort by score (ascending)
    const chaptersWithScores = Object.values(chapterScores)
        .map(chapter => ({
            ...chapter,
            average: chapter.totalMaxMarks > 0 
                ? Math.round((chapter.totalMarks / chapter.totalMaxMarks) * 100)
                : 0
        }))
        .filter(chapter => chapter.attempts >= 2) // Minimum 2 attempts per chapter
        .sort((a, b) => a.average - b.average);
    
    console.log('Chapters with 2+ attempts:', chaptersWithScores.length, chaptersWithScores);
    
    // Update UI
    const weakTopicsList = document.getElementById('weakTopicsList');
    if (!weakTopicsList) return;
    
    // Check if at least 3 chapters have been completed (with 2+ attempts each)
    if (chaptersWithScores.length < 3) {
        weakTopicsList.innerHTML = '<div class="loading-state">Complete at least 3 chapters (2+ attempts each) to see weak topics</div>';
        return;
    }
    
    // Always show up to 2 topics (the weakest)
    const weakTopics = chaptersWithScores.slice(0, 2);
    
    weakTopicsList.innerHTML = weakTopics.map(topic => `
        <div class="weak-topic-item">
            <div class="topic-info">
                <div class="topic-name">📉 ${topic.name}</div>
                <div class="topic-stats">${topic.attempts} attempts • Avg ${topic.average}%</div>
            </div>
            <div class="topic-score">${topic.average}%</div>
            <div class="topic-action">
                <a href="chapter-questions.html?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(topic.name)}" class="btn-practice">Practice More →</a>
            </div>
        </div>
    `).join('');
}

// Calculate Weak Exams (Year paper-based practice)
function calculateWeakExams(grades, subject) {
    console.log('calculateWeakExams - Input:', grades.length, 'grades');
    
    // Filter only grades with year/paper information (exam papers) from 2018-2025
    const examGrades = grades.filter(grade => {
        if (!grade.year || !grade.paper) return false;
        const year = parseInt(grade.year);
        return year >= 2018 && year <= 2025;
    });
    console.log('Exam paper grades found (2018-2025):', examGrades.length);
    
    // Group grades by year and session
    const examScores = {};
    
    examGrades.forEach(grade => {
        const examKey = `${grade.year} ${grade.session}`;
        
        if (!examScores[examKey]) {
            examScores[examKey] = {
                totalMarks: 0,
                totalMaxMarks: 0,
                attempts: 0,
                year: grade.year,
                session: grade.session,
                paper: grade.paper
            };
        }
        
        examScores[examKey].totalMarks += grade.marks || 0;
        examScores[examKey].totalMaxMarks += grade.maxMarks || 0;
        examScores[examKey].attempts++;
    });
    
    console.log('Grouped exams:', Object.keys(examScores).length, examScores);
    
    // Calculate averages and sort by score (ascending)
    const examsWithScores = Object.values(examScores)
        .map(exam => ({
            ...exam,
            average: exam.totalMaxMarks > 0 
                ? Math.round((exam.totalMarks / exam.totalMaxMarks) * 100)
                : 0
        }))
        .filter(exam => exam.attempts >= 2) // Minimum 2 questions per exam
        .sort((a, b) => a.average - b.average);
    
    console.log('Exams with 2+ questions:', examsWithScores.length, examsWithScores);
    
    // Update UI
    const weakExamsList = document.getElementById('weakExamsList');
    if (!weakExamsList) return;
    
    // Check if at least 3 exams have been completed with 2+ questions
    if (examsWithScores.length < 3) {
        weakExamsList.innerHTML = '<div class="loading-state">Complete at least 3 exam papers (2+ questions each) to see weak exams</div>';
        return;
    }
    
    // Always show exactly 3 exams (the weakest)
    const weakExams = examsWithScores.slice(0, 3);
    
    weakExamsList.innerHTML = weakExams.map(exam => `
        <div class="weak-topic-item">
            <div class="topic-info">
                <div class="topic-name">📄 ${exam.year} ${exam.session}</div>
                <div class="topic-stats">${exam.attempts} questions • Avg ${exam.average}%</div>
            </div>
            <div class="topic-score">${exam.average}%</div>
            <div class="topic-action">
                <a href="exam-review.html?subject=${encodeURIComponent(subject)}&year=${exam.year}&session=${encodeURIComponent(exam.session)}&paper=${exam.paper}" class="btn-practice">Review →</a>
            </div>
        </div>
    `).join('');
}

// Calculate Study Habits
async function calculateStudyHabits(grades, user) {
    // Load goal from user profile
    const userProfile = await firestoreData.getUserProfile(user.uid);
    const studyGoal = userProfile?.data?.studyPlan?.studyGoal || 'chapters';
    
    // Update goal banner
    const goalText = document.getElementById('goalText');
    if (goalText) {
        goalText.textContent = studyGoal === 'chapters' ? 'Goal: Practice chapter questions' : 'Goal: Practice full exams';
    }
    
    // Update "This Week" header to show current chapter for chapter practice goal
    const thisWeekHeader = document.getElementById('thisWeekHeader');
    if (studyGoal === 'chapters' && thisWeekHeader) {
        // First try to get from sessionStorage (Continue Where You Left Off)
        let currentChapter = sessionStorage.getItem('selectedChapter');
        
        // If not in session, get the most recent chapter from grades
        if (!currentChapter && grades.length > 0) {
            const chapterGrades = grades.filter(g => g.chapter);
            if (chapterGrades.length > 0) {
                const sorted = [...chapterGrades].sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                currentChapter = sorted[0].chapter;
            }
        }
        
        // Update header with current chapter
        if (currentChapter) {
            thisWeekHeader.textContent = `This Week: ${currentChapter}`;
        } else {
            thisWeekHeader.textContent = 'This Week';
        }
    } else if (thisWeekHeader) {
        thisWeekHeader.textContent = 'This Week';
    }
    
    // Filter grades based on goal
    let filteredGrades = grades;
    if (studyGoal === 'chapters') {
        // Only chapter-based practice - no year field OR year in 2010-2017
        filteredGrades = grades.filter(g => {
            if (!g.chapter) return false;
            // If no year field, include it
            if (!g.year) return true;
            // If has year field, check it's in range 2010-2017
            const year = parseInt(g.year);
            return year >= 2010 && year <= 2017;
        });
    } else if (studyGoal === 'exams') {
        // Only full exam papers from 2018-2025
        filteredGrades = grades.filter(g => {
            if (!g.year || !g.paper) return false;
            const year = parseInt(g.year);
            return year >= 2018 && year <= 2025;
        });
    }
    
    // Sort by timestamp
    const sortedGrades = [...filteredGrades].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    if (sortedGrades.length === 0) {
        return;
    }
    
    // Get last practice date
    const lastPracticeDate = new Date(sortedGrades[0].timestamp);
    const now = new Date();
    const daysSinceLastPractice = Math.floor((now - lastPracticeDate) / (1000 * 60 * 60 * 24));
    
    let lastPracticeText = '';
    if (daysSinceLastPractice === 0) {
        lastPracticeText = 'Today';
    } else if (daysSinceLastPractice === 1) {
        lastPracticeText = 'Yesterday';
    } else if (daysSinceLastPractice < 7) {
        lastPracticeText = `${daysSinceLastPractice} days ago`;
    } else {
        lastPracticeText = lastPracticeDate.toLocaleDateString();
    }
    
    // Calculate streak
    let streak = 0;
    const dateSet = new Set();
    sortedGrades.forEach(grade => {
        const date = new Date(grade.timestamp).toDateString();
        dateSet.add(date);
    });
    
    // Calculate consecutive days from today backwards
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        if (dateSet.has(checkDate.toDateString())) {
            streak = i + 1;
        } else {
            break;
        }
    }
    
    // Calculate weekly stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekGrades = sortedGrades.filter(g => new Date(g.timestamp) >= oneWeekAgo);
    
    // Update UI based on goal
    const streakValue = document.getElementById('streakValue');
    const lastPracticeTime = document.getElementById('lastPracticeTime');
    
    if (streakValue) streakValue.textContent = streak;
    if (lastPracticeTime) lastPracticeTime.textContent = lastPracticeText;
    
    // Update stat labels and values based on goal
    const stat1Label = document.getElementById('stat1Label');
    const stat1Value = document.getElementById('stat1Value');
    const stat2Label = document.getElementById('stat2Label');
    const stat2Value = document.getElementById('stat2Value');
    const stat3Label = document.getElementById('stat3Label');
    const stat3Value = document.getElementById('stat3Value');
    const stat4Label = document.getElementById('stat4Label');
    const stat4Value = document.getElementById('stat4Value');
    
    if (studyGoal === 'exams') {
        // Stats for full exam practice
        // Calculate completion rate (2018-2025: 8 years × 2 sessions = 16 exams)
        const totalAvailableExams = 16;
        const uniqueExamsAttempted = new Set(sortedGrades.map(g => `${g.year}-${g.session}`));
        const completionRate = Math.round((uniqueExamsAttempted.size / totalAvailableExams) * 100);
        
        // Group grades by exam to calculate overall exam marks for this week
        const examScores = {};
        weekGrades.forEach(g => {
            const examKey = `${g.year}-${g.session}`;
            if (!examScores[examKey]) {
                examScores[examKey] = {
                    totalMarks: 0,
                    totalMaxMarks: 0,
                    questionCount: 0
                };
            }
            examScores[examKey].totalMarks += g.marks || 0;
            examScores[examKey].totalMaxMarks += g.maxMarks || 0;
            examScores[examKey].questionCount++;
        });
        
        // Calculate overall percentage for each exam
        const examPercentages = Object.values(examScores).map(exam => 
            exam.totalMaxMarks > 0 ? Math.round((exam.totalMarks / exam.totalMaxMarks) * 100) : 0
        );
        
        const examsCompleted = Object.keys(examScores).length;
        
        // Calculate avg questions per exam
        const totalQuestions = Object.values(examScores).reduce((sum, exam) => sum + exam.questionCount, 0);
        const avgPerExam = examsCompleted > 0 ? Math.round(totalQuestions / examsCompleted) : 0;
        
        // Calculate best and lowest overall exam marks
        const bestMark = examPercentages.length > 0 ? Math.max(...examPercentages) : 0;
        const lowestMark = examPercentages.length > 0 ? Math.min(...examPercentages) : 0;
        
        if (stat1Label) stat1Label.textContent = 'Exams completed';
        if (stat1Value) stat1Value.textContent = examsCompleted;
        if (stat2Label) stat2Label.textContent = 'Completion rate';
        if (stat2Value) stat2Value.textContent = `${completionRate}%`;
        if (stat3Label) stat3Label.textContent = 'Best mark';
        if (stat3Value) stat3Value.textContent = `${bestMark}%`;
        if (stat4Label) stat4Label.textContent = 'Lowest mark';
        if (stat4Value) stat4Value.textContent = `${lowestMark}%`;
        
        // Generate activity histogram for last 5 days
        generateActivityHistogram(sortedGrades, 'exams');
    } else {
        // Stats for chapter practice
        // Calculate chapter completion % (F102 has 12 chapters)
        const totalChapters = 12;
        const uniqueChapters = new Set(sortedGrades.map(g => g.chapter).filter(Boolean));
        const chapterCompletion = Math.round((uniqueChapters.size / totalChapters) * 100);
        
        // Calculate questions to mastery (60%+ average)
        const chapterScores = {};
        sortedGrades.forEach(g => {
            if (!g.chapter) return;
            if (!chapterScores[g.chapter]) {
                chapterScores[g.chapter] = { totalMarks: 0, totalMaxMarks: 0, count: 0 };
            }
            chapterScores[g.chapter].totalMarks += g.marks || 0;
            chapterScores[g.chapter].totalMaxMarks += g.maxMarks || 0;
            chapterScores[g.chapter].count++;
        });
        
        const chaptersUnder60 = Object.values(chapterScores).filter(ch => {
            const avg = ch.totalMaxMarks > 0 ? (ch.totalMarks / ch.totalMaxMarks) * 100 : 0;
            return avg < 60;
        });
        
        // Estimate questions needed (assume 3-5 more questions per weak chapter)
        const questionsToMastery = chaptersUnder60.length * 4;
        
        // Calculate chapter coverage % (attempted questions / estimated total questions)
        // Estimate ~50 questions per chapter for F102
        const estimatedTotalQuestions = totalChapters * 50; // 600 total questions
        const attemptedQuestions = sortedGrades.length;
        const coveragePercentage = Math.round((attemptedQuestions / estimatedTotalQuestions) * 100);
        
        // Weekly stats
        const weekQuestions = weekGrades.length;
        
        if (stat1Label) stat1Label.textContent = 'Questions this week';
        if (stat1Value) stat1Value.textContent = weekQuestions;
        if (stat2Label) stat2Label.textContent = 'Chapter completion';
        if (stat2Value) stat2Value.textContent = `${chapterCompletion}%`;
        if (stat3Label) stat3Label.textContent = 'Questions to mastery';
        if (stat3Value) stat3Value.textContent = questionsToMastery > 0 ? questionsToMastery : '✓';
        if (stat4Label) stat4Label.textContent = 'Total coverage';
        if (stat4Value) stat4Value.textContent = `${coveragePercentage}%`;
        
        // Generate activity histogram for last 5 days
        generateActivityHistogram(sortedGrades, 'chapters');
    }
}

function generateActivityHistogram(grades, mode) {
    const histogramDiv = document.getElementById('activityHistogram');
    const histogramBars = document.getElementById('histogramBars');
    const weekHeader = document.getElementById('weekHeader');
    
    if (!histogramDiv || !histogramBars) return;
    
    // Calculate activity for last 5 days
    const today = new Date();
    const dailyActivity = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        
        let count = 0;
        
        if (mode === 'exams') {
            // Count unique exam papers attempted on this day
            const dayGrades = grades.filter(g => {
                const gradeDate = new Date(g.timestamp);
                return gradeDate >= date && gradeDate < nextDate;
            });
            
            const uniqueExams = new Set(dayGrades.map(g => `${g.year}-${g.session}`));
            count = uniqueExams.size;
        } else {
            // Count questions attempted on this day (chapters mode)
            count = grades.filter(g => {
                const gradeDate = new Date(g.timestamp);
                return gradeDate >= date && gradeDate < nextDate;
            }).length;
        }
        
        dailyActivity.push({
            day: dayNames[date.getDay()],
            count: count,
            date: date
        });
    }
    
    // Find max count for scaling
    const maxCount = Math.max(...dailyActivity.map(d => d.count), 1);
    
    // Update header based on mode
    if (weekHeader) {
        weekHeader.textContent = mode === 'exams' ? 'Papers Attempted (Last 5 Days)' : 'Questions Attempted (Last 5 Days)';
    }
    
    // Generate histogram bars
    histogramBars.innerHTML = dailyActivity.map(day => {
        const heightPercent = (day.count / maxCount) * 100;
        return `
            <div class="histogram-bar">
                <div class="bar-container">
                    <div class="bar-value">${day.count}</div>
                    <div class="bar-fill" style="height: ${heightPercent}%"></div>
                </div>
                <div class="bar-label">${day.day}</div>
            </div>
        `;
    }).join('');
    
    // Show the histogram
    histogramDiv.style.display = 'block';
}

function updateAnalyticsWithEmptyState() {
    // Update Exam Readiness Score
    const scoreValue = document.getElementById('scoreValue');
    const scoreStatus = document.getElementById('scoreStatus');
    const readinessProgress = document.getElementById('readinessProgress');
    const chaptersCompleted = document.getElementById('chaptersCompleted');
    const improvementTrendEl = document.getElementById('improvementTrend');
    
    if (scoreValue) scoreValue.textContent = '0%';
    if (scoreStatus) {
        scoreStatus.textContent = 'Start practicing to see your score';
        scoreStatus.style.color = 'var(--text-muted)';
    }
    if (readinessProgress) readinessProgress.style.width = '0%';
    if (chaptersCompleted) chaptersCompleted.textContent = '0/12 chapters practiced';
    if (improvementTrendEl) improvementTrendEl.textContent = 'No data yet';
    
    // Update Weak Topics
    const weakTopicsList = document.getElementById('weakTopicsList');
    if (weakTopicsList) {
        weakTopicsList.innerHTML = '<div class="loading-state">Start practicing chapters to see your weak topics</div>';
    }
    
    // Update Weak Exams
    const weakExamsList = document.getElementById('weakExamsList');
    if (weakExamsList) {
        weakExamsList.innerHTML = '<div class="loading-state">Start practicing exam papers to see weak exams</div>';
    }
    
    // Update Study Habits
    const streakValue = document.getElementById('streakValue');
    const lastPracticeTime = document.getElementById('lastPracticeTime');
    const weekQuestions = document.getElementById('weekQuestions');
    const weekSessionsEl = document.getElementById('weekSessions');
    const avgPerSessionEl = document.getElementById('avgPerSession');
    
    if (streakValue) streakValue.textContent = '0';
    if (lastPracticeTime) lastPracticeTime.textContent = 'Never';
    if (weekQuestions) weekQuestions.textContent = '0';
    if (weekSessionsEl) weekSessionsEl.textContent = '0';
    if (avgPerSessionEl) avgPerSessionEl.textContent = '0';
}

// Initialize
checkAuthAndLoadProfile();

// Handle sign out
const signoutModal = document.getElementById('signoutConfirmModal');
const signoutYes = signoutModal && signoutModal.querySelector('#signoutConfirmYes');
const signoutNo = signoutModal && signoutModal.querySelector('#signoutConfirmNo');

function showSignoutModal() {
    if (!signoutModal) return;
    signoutModal.style.display = 'flex';
}

function hideSignoutModal() {
    if (!signoutModal) return;
    signoutModal.style.display = 'none';
}

if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSignoutModal();
    });
}

if (signoutNo) signoutNo.addEventListener('click', () => hideSignoutModal());
if (signoutYes) signoutYes.addEventListener('click', async () => {
    hideSignoutModal();
    try {
        await firebaseAuth.signout();
    } catch (err) {
        console.error('Sign out failed:', err);
    }
    window.location.href = '../index.html';
});

// Initialize activity monitor for auto-logout
initActivityMonitor();

// Add click handlers for action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        alert('This feature is coming soon! For now, explore the past papers in the workspace.');
    });
});

// Add click handlers for dashboard cards (except those with real navigation targets)
// Allow practice-by-chapter.html as a real link so the Practice card navigates to the new page.
const allowedLinks = new Set([
    'progress-tracker.html',
    'help-support.html',
    'practice.html',
    'practice-by-chapter.html',
    'subjects.html?mode=practice'
]);
document.querySelectorAll('.card-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!allowedLinks.has(href)) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('This feature is coming soon! For now, explore the past papers in the workspace.');
        });
    }
});

// Calculate Study Plan and Countdown
async function calculateStudyPlan(user) {
    try {
        // Load user profile to get study plan
        const userProfile = await firestoreData.getUserProfile(user.uid);
        
        if (!userProfile.success || !userProfile.data || !userProfile.data.studyPlan) {
            // No study plan set - show setup prompt
            updateStudyPlanWithEmptyState();
            return;
        }
        
        const plan = userProfile.data.studyPlan;
        const { examDate, hoursPerDay, daysPerWeek } = plan;
        
        if (!examDate || !hoursPerDay || !daysPerWeek) {
            updateStudyPlanWithEmptyState();
            return;
        }
        
        // Calculate days until exam
        const today = new Date();
        const exam = new Date(examDate);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysLeft = Math.ceil((exam - today) / msPerDay);
        
        // Calculate available study hours
        const weeksLeft = daysLeft / 7;
        const availableHours = Math.round(weeksLeft * daysPerWeek * hoursPerDay);
        
        // Update countdown display
        const daysLeftDisplay = document.getElementById('daysLeftDisplay');
        const countdownNumber = daysLeftDisplay?.querySelector('.countdown-number');
        const countdownLabel = daysLeftDisplay?.querySelector('.countdown-label');
        const totalAvailableHours = document.getElementById('totalAvailableHours');
        
        if (countdownNumber) {
            countdownNumber.textContent = daysLeft > 0 ? daysLeft : 0;
        }
        if (countdownLabel) {
            countdownLabel.textContent = daysLeft > 0 ? 
                (daysLeft === 1 ? 'Day Until Exam' : 'Days Until Exam') : 
                'Exam Date Passed';
        }
        if (totalAvailableHours) {
            totalAvailableHours.textContent = `${availableHours}h`;
        }
        
        // Calculate hours needed based on exam papers from 2010-2025
        const yearsOfPapers = 16; // 2010-2025
        const sessionsPerYear = 2; // June and November
        const hoursPerExam = 3.2; // Exam duration
        const totalPapers = yearsOfPapers * sessionsPerYear;
        const totalHoursNeeded = Math.round(totalPapers * hoursPerExam);
        
        // Calculate hours already spent from graded questions
        const grades = await firestoreData.getQuestionGrades(user.uid);
        const gradesArray = Array.isArray(grades) ? grades : [];
        
        // Filter grades for the primary exam
        const primaryExam = userProfile.data.primaryExam;
        const examGrades = primaryExam ? gradesArray.filter(g => g.subject === primaryExam) : gradesArray;
        
        // Calculate time spent: 1.8 minutes per mark × maxMarks for each question
        let totalMinutesSpent = 0;
        examGrades.forEach(grade => {
            if (grade.maxMarks) {
                const minutesForQuestion = 1.8 * grade.maxMarks;
                totalMinutesSpent += minutesForQuestion;
            }
        });
        
        const hoursSpent = Math.round(totalMinutesSpent / 60);
        const hoursRemaining = Math.max(0, totalHoursNeeded - hoursSpent);
        const progressPercentage = Math.min(100, Math.round((hoursSpent / totalHoursNeeded) * 100));
        
        // Calculate reading hours: Available time - Practice time needed
        const readingHours = Math.max(0, availableHours - hoursRemaining);
        
        // Update UI
        const practiceHoursEl = document.getElementById('practiceHours');
        const readingHoursEl = document.getElementById('readingHours');
        const studyProgressEl = document.getElementById('studyProgress');
        const setupPlanLink = document.getElementById('setupPlanLink');
        
        if (practiceHoursEl) practiceHoursEl.textContent = `${hoursRemaining}h`;
        if (readingHoursEl) {
            readingHoursEl.textContent = `${readingHours}h`;
            // Color code reading hours
            if (readingHours > 0) {
                readingHoursEl.style.color = '#10b981'; // Green - have extra time
            } else {
                readingHoursEl.style.color = '#dc2626'; // Red - no extra time
            }
        }
        if (studyProgressEl) {
            studyProgressEl.textContent = `${hoursSpent}h`;
            // Color code based on if they're on track
            if (availableHours >= hoursRemaining) {
                // On track - green
                studyProgressEl.style.color = '#10b981';
            } else if (availableHours >= hoursRemaining * 0.7) {
                // Slightly behind - orange
                studyProgressEl.style.color = '#f59e0b';
            } else {
                // Behind schedule - red
                studyProgressEl.style.color = '#dc2626';
            }
        }
        if (setupPlanLink) setupPlanLink.textContent = 'Update Study Plan →';
        
    } catch (error) {
        console.error('Error calculating study plan:', error);
        updateStudyPlanWithEmptyState();
    }
}

function updateStudyPlanWithEmptyState() {
    const countdownNumber = document.querySelector('.countdown-number');
    const countdownLabel = document.querySelector('.countdown-label');
    const totalAvailableHours = document.getElementById('totalAvailableHours');
    const practiceHoursEl = document.getElementById('practiceHours');
    const readingHoursEl = document.getElementById('readingHours');
    const studyProgressEl = document.getElementById('studyProgress');
    const setupPlanLink = document.getElementById('setupPlanLink');
    
    if (countdownNumber) countdownNumber.textContent = '--';
    if (countdownLabel) countdownLabel.textContent = 'No Exam Date Set';
    if (totalAvailableHours) totalAvailableHours.textContent = '--';
    if (practiceHoursEl) practiceHoursEl.textContent = '--';
    if (readingHoursEl) readingHoursEl.textContent = '--';
    if (studyProgressEl) studyProgressEl.textContent = '--';
    if (setupPlanLink) setupPlanLink.textContent = 'Set Up Study Plan →';
}
