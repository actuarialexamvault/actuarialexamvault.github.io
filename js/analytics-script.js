// Performance & Analytics page script
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';
import { initActivityMonitor } from './activity-monitor.js';
import { themeManager } from './theme-manager.js';

// ---------------------------------------------------------------------------
// Merged grade loader: reads Firestore first, merges any extra entries from
// IndexedDB. This means locally-saved grades (not yet synced to Firestore)
// are still visible in analytics.
// ---------------------------------------------------------------------------
async function loadAllGrades(userId, subject = null) {
    let firestoreGrades = [];
    let idbGrades = [];

    try {
        firestoreGrades = (await firestoreData.getQuestionGrades(userId, subject)) || [];
    } catch (e) {
        console.warn('[analytics] Firestore grades fetch failed:', e);
    }

    try {
        idbGrades = (await indexedDBStorage.getQuestionGrades(userId, subject)) || [];
    } catch (e) {
        console.warn('[analytics] IndexedDB grades fetch failed:', e);
    }

    if (firestoreGrades.length === 0) return idbGrades;
    if (idbGrades.length === 0) return firestoreGrades;

    // Dedup by actual document identity so that the same record stored in both
    // Firestore and IndexedDB is only counted once, but two different submissions
    // of the same question (different doc IDs, e.g. old key vs new _CH key) are
    // both kept.
    // Firestore records carry _id (doc.id). IDB records carry id = 'grade_' + equivalent.
    const recordKey = g => g._id || (g.id ? g.id.replace(/^grade_/, '') : null);
    const seen = new Map();
    for (const g of firestoreGrades) {
        const k = recordKey(g);
        if (k) seen.set(k, g);
    }
    for (const g of idbGrades) {
        const k = recordKey(g);
        if (!k || !seen.has(k)) seen.set(k || Math.random(), g);
    }
    return [...seen.values()];
}

const userNameEl = document.getElementById('userName');
const signOutBtn = document.getElementById('signOutBtn');
const themeToggle = document.getElementById('themeToggle');

// Theme management
function initTheme(user) {
    themeManager.init();
    themeToggle.addEventListener('click', () => {
        themeManager.toggleTheme(user);
    });
}

async function checkAuthAndLoad() {
    const user = await firebaseAuth.requireAuth('signin.html');
    if (!user) return;

    // Display name
    const profileResult = await firestoreData.getUserProfile(user.uid);
    if (profileResult.success && profileResult.data) {
        let displayName;
        if (profileResult.data.name) {
            displayName = profileResult.data.name;
        } else if (profileResult.data.fullname) {
            displayName = profileResult.data.fullname.split(' ')[0];
        } else {
            displayName = user.email;
        }
        if (userNameEl) userNameEl.textContent = displayName;
    } else {
        if (userNameEl) userNameEl.textContent = user.email;
    }

    initTheme(user);
    await loadAnalytics(user);
}

// Load and calculate analytics
async function loadAnalytics(user) {
    try {
        const profileResult = await firestoreData.getUserProfile(user.uid);
        const primaryExam = profileResult.success && profileResult.data && profileResult.data.primaryExam;

        if (!primaryExam) {
            const notice = document.getElementById('noPrimaryExamNotice');
            if (notice) notice.style.display = 'block';
            return;
        }

        const analyticsSection = document.getElementById('analyticsSection');
        if (analyticsSection) analyticsSection.style.display = 'block';

        const examGrades = await loadAllGrades(user.uid, primaryExam);

        if (!examGrades || examGrades.length === 0) {
            updateAnalyticsWithEmptyState();
            return;
        }

        await calculateExamReadiness(examGrades, primaryExam);
        calculateWeakTopics(examGrades, primaryExam);
        calculateWeakExams(examGrades, primaryExam);
        await calculateStudyHabits(examGrades, user);
        generateChapterQuestionsChart(examGrades);
        calculateOverallAttemptHistory(examGrades);

        const viewAllPapersLink = document.getElementById('viewAllPapersLink');
        if (viewAllPapersLink && primaryExam) {
            viewAllPapersLink.href = `past-exams.html?subject=${encodeURIComponent(primaryExam)}`;
        }

        await calculateStudyPlan(user);

    } catch (error) {
        console.error('Error loading analytics:', error);
        updateAnalyticsWithEmptyState();
    }
}

// Calculate Exam Readiness Score
// Formula (weights in parens):
//   35% chapter depth   — avg( distinct_attempted / total_available ) per chapter across ALL chapters
//   25% exam attempts   — distinct full exam papers attempted / 5-paper target (capped 100%)
//   20% average score   — weighted average % across every graded question
//   15% chapter breadth — proportion of chapters where ≥1 question was attempted
//    5% improvement trend
async function calculateExamReadiness(grades, subject) {
    // --- Load manifest to get exact question counts per chapter ---
    let manifestChapterTotals = {}; // { chapterName: totalAvailableQuestions }
    let totalChapters = 12;
    try {
        const url = `../resources/markdown_questions/questions/${subject}/manifest_questions.json`;
        const res = await fetch(url);
        if (res.ok) {
            const manifest = await res.json();
            manifest.forEach(item => {
                (item.chapters || []).forEach(ch => {
                    manifestChapterTotals[ch] = (manifestChapterTotals[ch] || 0) + 1;
                });
            });
            totalChapters = Object.keys(manifestChapterTotals).length || 12;
        }
    } catch (e) {
        console.warn('[analytics] Could not load manifest for depth calculation:', e);
    }
    const manifestAvailable = Object.keys(manifestChapterTotals).length > 0;

    // --- Average score (20%) ---
    const averageScore = grades.length > 0
        ? grades.reduce((sum, g) => sum + (g.maxMarks > 0 ? (g.marks / g.maxMarks) * 100 : 0), 0) / grades.length
        : 0;

    // --- Chapter breadth + depth setup ---
    const chaptersAttempted = new Set();
    const distinctQPerChapter = {}; // { chapterName: Set<questionId> }
    grades.forEach(g => {
        if (!g.chapter) return;
        chaptersAttempted.add(g.chapter);
        if (!distinctQPerChapter[g.chapter]) distinctQPerChapter[g.chapter] = new Set();
        distinctQPerChapter[g.chapter].add(String(g.question));
    });

    // Breadth (15%): chapters touched / total chapters
    const breadthScore = (chaptersAttempted.size / totalChapters) * 100;

    // Depth (35%): avg( attempted_distinct / available ) per chapter, unstarted chapters = 0
    let depthScore;
    if (manifestAvailable) {
        let totalDepthPct = 0;
        for (const [ch, available] of Object.entries(manifestChapterTotals)) {
            const done = distinctQPerChapter[ch] ? distinctQPerChapter[ch].size : 0;
            totalDepthPct += Math.min(100, (done / available) * 100);
        }
        depthScore = totalDepthPct / totalChapters;
    } else {
        // Fallback when manifest is unavailable: target 10 questions per chapter
        const TARGET_Q = 10;
        let totalDepthPct = 0;
        for (const ch of chaptersAttempted) {
            totalDepthPct += Math.min(100, ((distinctQPerChapter[ch]?.size || 0) / TARGET_Q) * 100);
        }
        depthScore = totalChapters > 0 ? totalDepthPct / totalChapters : 0;
    }

    // --- Full exam attempts (25%): distinct (year, session, paper) combos ---
    const TARGET_FULL_EXAMS = 5;
    const fullExamKeys = new Set();
    const fullExamScores = {};
    grades.forEach(g => {
        if (!g.year || !g.paper) return;
        const year = parseInt(g.year);
        if (year < 2018 || year > 2025) return;
        const key = `${g.year}-${g.session}-P${g.paper}`;
        fullExamKeys.add(key);
        if (!fullExamScores[key]) fullExamScores[key] = { totalMarks: 0, totalMaxMarks: 0 };
        fullExamScores[key].totalMarks  += g.marks    || 0;
        fullExamScores[key].totalMaxMarks += g.maxMarks || 0;
    });
    const examAttemptsScore = Math.min(100, (fullExamKeys.size / TARGET_FULL_EXAMS) * 100);

    // --- Improvement trend (5%) ---
    let improvementTrend = 0;
    if (grades.length >= 5) {
        const sortedGrades = [...grades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent5   = sortedGrades.slice(0, 5);
        const previous5 = sortedGrades.slice(5, 10);
        if (previous5.length > 0) {
            const avg = arr => arr.reduce((s, g) => s + (g.maxMarks > 0 ? (g.marks / g.maxMarks) * 100 : 0), 0) / arr.length;
            improvementTrend = avg(recent5) - avg(previous5);
        }
    }
    const normalizedImprovement = Math.max(0, Math.min(100, 50 + improvementTrend * 5));

    // --- Composite readiness score ---
    const readinessScore = Math.round(
        (depthScore         * 0.35) +
        (examAttemptsScore  * 0.25) +
        (averageScore       * 0.20) +
        (breadthScore       * 0.15) +
        (normalizedImprovement * 0.05)
    );

    // --- Projected exam score (full exam papers only — chapter practice excluded) ---
    // Each entry in fullExamScores is one paper sitting; compute % per paper then average.
    const examResults = Object.values(fullExamScores)
        .map(d => d.totalMaxMarks > 0 ? (d.totalMarks / d.totalMaxMarks) * 100 : null)
        .filter(v => v !== null);
    let projectedExamScore = null; // null = no exam data yet
    if (examResults.length >= 3) {
        const recentExams = examResults.slice(-3);
        const olderExams  = examResults.slice(-6, -3);
        const rAvg = recentExams.reduce((s, e) => s + e, 0) / recentExams.length;
        if (olderExams.length > 0) {
            const oAvg = olderExams.reduce((s, e) => s + e, 0) / olderExams.length;
            projectedExamScore = Math.max(0, Math.min(100, Math.round(rAvg + (rAvg - oAvg))));
        } else {
            projectedExamScore = Math.round(rAvg);
        }
    } else if (examResults.length > 0) {
        projectedExamScore = Math.round(examResults.reduce((s, e) => s + e, 0) / examResults.length);
    }
    if (projectedExamScore !== null) projectedExamScore = Math.max(0, Math.min(100, projectedExamScore));

    // --- Status label ---
    let status, statusColor;
    if      (readinessScore < 20) { status = 'Just Getting Started'; statusColor = '#dc2626'; }
    else if (readinessScore < 40) { status = 'Early Stage';          statusColor = '#ef4444'; }
    else if (readinessScore < 55) { status = 'Building Foundation';  statusColor = '#f97316'; }
    else if (readinessScore < 70) { status = 'Building Confidence';  statusColor = '#f59e0b'; }
    else if (readinessScore < 85) { status = 'Approaching Ready';    statusColor = '#84cc16'; }
    else                          { status = 'Exam Ready!';           statusColor = '#10b981'; }

    // --- DOM updates ---
    const scoreValue        = document.getElementById('scoreValue');
    const scoreStatus       = document.getElementById('scoreStatus');
    const readinessProgress = document.getElementById('readinessProgress');
    const chaptersCompleted = document.getElementById('chaptersCompleted');
    const improvementTrendEl = document.getElementById('improvementTrend');
    const projectedScoreEl  = document.getElementById('projectedScore');

    if (scoreValue)        scoreValue.textContent  = `${readinessScore}%`;
    if (scoreStatus)       { scoreStatus.textContent = status; scoreStatus.style.color = statusColor; }
    if (readinessProgress) readinessProgress.style.width = `${readinessScore}%`;
    if (chaptersCompleted) {
        const depthPct = Math.round(depthScore);
        chaptersCompleted.textContent = `${chaptersAttempted.size}/${totalChapters} chapters • ${depthPct}% avg depth`;
    }
    if (improvementTrendEl) {
        const sym = improvementTrend > 0 ? '↗' : improvementTrend < 0 ? '↘' : '→';
        const txt = improvementTrend > 0 ? 'improvement' : improvementTrend < 0 ? 'decline' : 'stable';
        improvementTrendEl.textContent = `${sym} ${Math.abs(Math.round(improvementTrend))}% ${txt}`;
    }
    if (projectedScoreEl) {
        if (projectedExamScore === null) {
            projectedScoreEl.textContent = 'Attempt a past exam paper to see projected score';
            projectedScoreEl.style.color = 'var(--text-muted)';
        } else {
            projectedScoreEl.textContent = `${fullExamKeys.size} paper${fullExamKeys.size !== 1 ? 's' : ''} attempted • Projected: ${projectedExamScore}%`;
            projectedScoreEl.style.color = projectedExamScore >= 70 ? '#10b981' : projectedExamScore >= 50 ? '#f59e0b' : '#dc2626';
        }
    }
}

// Calculate Weak Topics (Chapter-based practice)
function calculateWeakTopics(grades, subject) {
    const chapterGrades = grades.filter(grade => grade.chapter);

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

    const chaptersWithScores = Object.values(chapterScores)
        .map(chapter => ({
            ...chapter,
            average: chapter.totalMaxMarks > 0
                ? Math.round((chapter.totalMarks / chapter.totalMaxMarks) * 100)
                : 0
        }))
        .filter(chapter => chapter.attempts >= 2 && chapter.average < 60)
        .sort((a, b) => a.average - b.average);

    const weakTopicsList = document.getElementById('weakTopicsList');
    if (!weakTopicsList) return;

    if (chaptersWithScores.length === 0) {
        weakTopicsList.innerHTML = '<div class="loading-state">No topics below 60% — keep it up!</div>';
        return;
    }

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
    const examGrades = grades.filter(grade => {
        if (!grade.year || !grade.paper) return false;
        const year = parseInt(grade.year);
        return year >= 2018 && year <= 2025;
    });

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

    const examsWithScores = Object.values(examScores)
        .map(exam => ({
            ...exam,
            average: exam.totalMaxMarks > 0
                ? Math.round((exam.totalMarks / exam.totalMaxMarks) * 100)
                : 0
        }))
        .filter(exam => exam.attempts >= 2)
        .sort((a, b) => a.average - b.average);

    const weakExamsList = document.getElementById('weakExamsList');
    if (!weakExamsList) return;

    if (examsWithScores.length === 0) {
        weakExamsList.innerHTML = '<div class="loading-state">Complete exam papers (2+ questions each) to see weak exams</div>';
        return;
    }

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
    const userProfile = await firestoreData.getUserProfile(user.uid);
    const studyGoal = userProfile?.data?.studyPlan?.studyGoal || 'chapters';

    const goalText = document.getElementById('goalText');
    if (goalText) {
        goalText.textContent = studyGoal === 'chapters' ? 'Goal: Practice chapter questions' : 'Goal: Practice full exams';
    }

    const thisWeekHeader = document.getElementById('thisWeekHeader');
    if (studyGoal === 'chapters' && thisWeekHeader) {
        let currentChapter = sessionStorage.getItem('selectedChapter');
        if (!currentChapter && grades.length > 0) {
            const chapterGrades = grades.filter(g => g.chapter);
            if (chapterGrades.length > 0) {
                const sorted = [...chapterGrades].sort((a, b) =>
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                currentChapter = sorted[0].chapter;
            }
        }
        if (currentChapter) {
            thisWeekHeader.textContent = `This Week: ${currentChapter}`;
        } else {
            thisWeekHeader.textContent = 'This Week';
        }
    } else if (thisWeekHeader) {
        thisWeekHeader.textContent = 'This Week';
    }

    let filteredGrades = grades;
    if (studyGoal === 'chapters') {
        filteredGrades = grades.filter(g => {
            if (!g.chapter) return false;
            if (!g.year) return true;
            const year = parseInt(g.year);
            return year >= 2010 && year <= 2017;
        });
    } else if (studyGoal === 'exams') {
        filteredGrades = grades.filter(g => {
            if (!g.year || !g.paper) return false;
            const year = parseInt(g.year);
            return year >= 2018 && year <= 2025;
        });
    }

    const sortedGrades = [...filteredGrades].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (sortedGrades.length === 0) return;

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

    let streak = 0;
    const dateSet = new Set();
    sortedGrades.forEach(grade => {
        const date = new Date(grade.timestamp).toDateString();
        dateSet.add(date);
    });

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

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekGrades = sortedGrades.filter(g => new Date(g.timestamp) >= oneWeekAgo);

    const streakValue = document.getElementById('streakValue');
    const lastPracticeTime = document.getElementById('lastPracticeTime');
    if (streakValue) streakValue.textContent = streak;
    if (lastPracticeTime) lastPracticeTime.textContent = lastPracticeText;

    const stat1Label = document.getElementById('stat1Label');
    const stat1Value = document.getElementById('stat1Value');
    const stat2Label = document.getElementById('stat2Label');
    const stat2Value = document.getElementById('stat2Value');
    const stat3Label = document.getElementById('stat3Label');
    const stat3Value = document.getElementById('stat3Value');
    const stat4Label = document.getElementById('stat4Label');
    const stat4Value = document.getElementById('stat4Value');

    if (studyGoal === 'exams') {
        const totalAvailableExams = 16;
        const uniqueExamsAttempted = new Set(sortedGrades.map(g => `${g.year}-${g.session}`));
        const completionRate = Math.round((uniqueExamsAttempted.size / totalAvailableExams) * 100);

        const examScores = {};
        weekGrades.forEach(g => {
            const examKey = `${g.year}-${g.session}`;
            if (!examScores[examKey]) {
                examScores[examKey] = { totalMarks: 0, totalMaxMarks: 0, questionCount: 0 };
            }
            examScores[examKey].totalMarks += g.marks || 0;
            examScores[examKey].totalMaxMarks += g.maxMarks || 0;
            examScores[examKey].questionCount++;
        });

        const examPercentages = Object.values(examScores).map(exam =>
            exam.totalMaxMarks > 0 ? Math.round((exam.totalMarks / exam.totalMaxMarks) * 100) : 0
        );
        const examsCompleted = Object.keys(examScores).length;
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

    } else {
        const totalChapters = 12;
        const uniqueChapters = new Set(sortedGrades.map(g => g.chapter).filter(Boolean));
        const chapterCompletion = Math.round((uniqueChapters.size / totalChapters) * 100);

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
        const questionsToMastery = chaptersUnder60.length * 4;

        const estimatedTotalQuestions = totalChapters * 50;
        const attemptedQuestions = sortedGrades.length;
        const coveragePercentage = Math.round((attemptedQuestions / estimatedTotalQuestions) * 100);

        const weekQuestions = weekGrades.length;

        if (stat1Label) stat1Label.textContent = 'Questions this week';
        if (stat1Value) stat1Value.textContent = weekQuestions;
        if (stat2Label) stat2Label.textContent = 'Chapter completion';
        if (stat2Value) stat2Value.textContent = `${chapterCompletion}%`;
        if (stat3Label) stat3Label.textContent = 'Questions to mastery';
        if (stat3Value) stat3Value.textContent = questionsToMastery > 0 ? questionsToMastery : '✓';
        if (stat4Label) stat4Label.textContent = 'Total coverage';
        if (stat4Value) stat4Value.textContent = `${coveragePercentage}%`;
    }
}

// Chart: total questions attempted per chapter (bar chart)
function generateChapterQuestionsChart(grades) {
    const container = document.getElementById('chapterQuestionsChart');
    const canvas    = document.getElementById('chapterChartCanvas');
    if (!container || !canvas) return;

    // Count attempts per chapter
    const counts = {};
    grades.forEach(g => {
        if (!g.chapter) return;
        // Strip leading "Chapter N:" prefix for a shorter label
        const label = g.chapter.replace(/^Chapter\s*\d+\s*:\s*/i, '').trim() || g.chapter;
        counts[label] = (counts[label] || 0) + 1;
    });

    if (Object.keys(counts).length === 0) return;

    const THRESHOLD = 5;
    const named = Object.entries(counts)
        .filter(([, n]) => n >= THRESHOLD)
        .sort(([, a], [, b]) => b - a);
    const otherTotal = Object.entries(counts)
        .filter(([, n]) => n < THRESHOLD)
        .reduce((s, [, n]) => s + n, 0);

    const labels = named.map(([k]) => k.length > 18 ? k.slice(0, 17) + '…' : k);
    const data   = named.map(([, v]) => v);
    const colors = named.map(() => 'rgba(0,212,170,0.78)');

    if (otherTotal > 0) {
        labels.push('Other');
        data.push(otherTotal);
        colors.push('rgba(156,163,175,0.75)');
    }

    // Destroy previous instance to avoid duplicates
    if (window._chapterChart) {
        window._chapterChart.destroy();
        window._chapterChart = null;
    }

    container.style.display = 'block';
    window._chapterChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: 'var(--text-muted)', font: { size: 11 } }, grid: { display: false } },
                y: { ticks: { color: 'var(--text-muted)', stepSize: 1 }, grid: { color: 'rgba(128,128,128,0.15)' }, beginAtZero: true }
            }
        }
    });
}

// Overall Attempt History & Performance table
function calculateOverallAttemptHistory(grades) {
    // Both `reviewType` (chapter questions) and `isAIReviewed` (exam papers) are used
    // across the codebase — handle both.
    const selfReviewed = grades.filter(g => {
        if (g.reviewType === 'ai') return false;
        if (g.isAIReviewed === true) return false;
        return true;
    });
    const aiReviewed = grades.filter(g => g.reviewType === 'ai' || g.isAIReviewed === true);

    function calcStats(list) {
        if (!list.length) return { questionsCount: 0, possibleMarks: 0, scoredMarks: '0.0', performance: 0 };
        const possibleMarks = list.reduce((s, g) => s + (g.maxMarks || 0), 0);
        const scoredMarks   = list.reduce((s, g) => s + (g.marks    || 0), 0);
        return {
            questionsCount: list.length,
            possibleMarks,
            scoredMarks: scoredMarks.toFixed(1),
            performance: possibleMarks > 0 ? Math.round((scoredMarks / possibleMarks) * 100) : 0
        };
    }

    function applyStats(prefix, stats) {
        const q = document.getElementById(`${prefix}QuestionsCount`);
        const p = document.getElementById(`${prefix}PossibleMarks`);
        const s = document.getElementById(`${prefix}ScoredMarks`);
        const b = document.getElementById(`${prefix}Performance`);
        if (q) q.textContent = stats.questionsCount;
        if (p) p.textContent = stats.possibleMarks;
        if (s) s.textContent = stats.scoredMarks;
        if (b) b.textContent = `${stats.performance}%`;
    }

    applyStats('self', calcStats(selfReviewed));
    applyStats('ai',   calcStats(aiReviewed));
}

function updateAnalyticsWithEmptyState() {
    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection) analyticsSection.style.display = 'block';

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

    const weakTopicsList = document.getElementById('weakTopicsList');
    if (weakTopicsList) {
        weakTopicsList.innerHTML = '<div class="loading-state">Start practicing chapters to see your weak topics</div>';
    }

    const weakExamsList = document.getElementById('weakExamsList');
    if (weakExamsList) {
        weakExamsList.innerHTML = '<div class="loading-state">Start practicing exam papers to see weak exams</div>';
    }

    const streakValue = document.getElementById('streakValue');
    const lastPracticeTime = document.getElementById('lastPracticeTime');
    if (streakValue) streakValue.textContent = '0';
    if (lastPracticeTime) lastPracticeTime.textContent = 'Never';
}

// Calculate Study Plan and Countdown
async function calculateStudyPlan(user) {
    try {
        const userProfile = await firestoreData.getUserProfile(user.uid);

        if (!userProfile.success || !userProfile.data || !userProfile.data.studyPlan) {
            updateStudyPlanWithEmptyState();
            return;
        }

        const plan = userProfile.data.studyPlan;
        const { examDate, hoursPerDay, daysPerWeek } = plan;

        if (!examDate || !hoursPerDay || !daysPerWeek) {
            updateStudyPlanWithEmptyState();
            return;
        }

        const today = new Date();
        const exam = new Date(examDate);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysLeft = Math.ceil((exam - today) / msPerDay);

        const weeksLeft = daysLeft / 7;
        const availableHours = Math.round(weeksLeft * daysPerWeek * hoursPerDay);

        const daysLeftDisplay = document.getElementById('daysLeftDisplay');
        const countdownNumber = daysLeftDisplay?.querySelector('.countdown-number');
        const countdownLabel = daysLeftDisplay?.querySelector('.countdown-label');
        const totalAvailableHours = document.getElementById('totalAvailableHours');

        if (countdownNumber) countdownNumber.textContent = daysLeft > 0 ? daysLeft : 0;
        if (countdownLabel) {
            countdownLabel.textContent = daysLeft > 0
                ? (daysLeft === 1 ? 'Day Until Exam' : 'Days Until Exam')
                : 'Exam Date Passed';
        }
        if (totalAvailableHours) totalAvailableHours.textContent = `${availableHours}h`;

        const yearsOfPapers = 16;
        const sessionsPerYear = 2;
        const hoursPerExam = 3.2;
        const totalPapers = yearsOfPapers * sessionsPerYear;
        const totalHoursNeeded = Math.round(totalPapers * hoursPerExam);

        const primaryExam = userProfile.data.primaryExam;
        const gradesArray = await loadAllGrades(user.uid, primaryExam || null);
        const examGrades = Array.isArray(gradesArray) ? gradesArray : [];

        let totalMinutesSpent = 0;
        examGrades.forEach(grade => {
            if (grade.maxMarks) {
                totalMinutesSpent += 1.8 * grade.maxMarks;
            }
        });

        const hoursSpent = Math.round(totalMinutesSpent / 60);
        const hoursRemaining = Math.max(0, totalHoursNeeded - hoursSpent);
        const readingHours = Math.max(0, availableHours - hoursRemaining);

        const practiceHoursEl = document.getElementById('practiceHours');
        const readingHoursEl = document.getElementById('readingHours');
        const studyProgressEl = document.getElementById('studyProgress');
        const setupPlanLink = document.getElementById('setupPlanLink');

        if (practiceHoursEl) practiceHoursEl.textContent = `${hoursRemaining}h`;
        if (readingHoursEl) {
            readingHoursEl.textContent = `${readingHours}h`;
            readingHoursEl.style.color = readingHours > 0 ? '#10b981' : '#dc2626';
        }
        if (studyProgressEl) {
            studyProgressEl.textContent = `${hoursSpent}h`;
            if (availableHours >= hoursRemaining) {
                studyProgressEl.style.color = '#10b981';
            } else if (availableHours >= hoursRemaining * 0.7) {
                studyProgressEl.style.color = '#f59e0b';
            } else {
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

// Initialize
checkAuthAndLoad();

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
