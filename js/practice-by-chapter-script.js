import { themeManager } from './theme-manager.js';
import { attachSignOutHandler } from './signout-modal.js';
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';

themeManager.init();

const chaptersContainer = document.getElementById('chaptersContainer');
const params = new URLSearchParams(window.location.search);
const subject = params.get('subject') || sessionStorage.getItem('selectedSubject');
const subjectTitle = params.get('subjectTitle') || sessionStorage.getItem('selectedSubjectTitle') || subject;

// document.getElementById('pageTitle').textContent = `${subject} — Practice by Chapter`;

attachSignOutHandler('#signOutBtn');

if (!subject) {
    chaptersContainer.innerHTML = '<p style="color:#666; padding:1rem;">No subject selected.</p>';
} else {
    loadManifest(subject).then(async manifest => {
        const grades = await getUserQuestionGrades();
        const chapters = aggregateChapters(manifest, grades);
        renderChapters(chapters);
    }).catch(err => {
        console.error('Failed to load manifest for subject', subject, err);
        chaptersContainer.innerHTML = '<p style="color:#666; padding:1rem;">Failed to load chapter manifest.</p>';
    });
}

async function getUserQuestionGrades() {
    try {
        const user = firebaseAuth.getCurrentUser();
        if (!user) return [];

        // Try Firestore first
        const fbGrades = await firestoreData.getQuestionGrades(user.uid);
        if (fbGrades && Array.isArray(fbGrades) && fbGrades.length > 0) return fbGrades;

        // Fallback to IndexedDB
        const idbGrades = await indexedDBStorage.getQuestionGrades(user.uid);
        if (idbGrades && Array.isArray(idbGrades)) return idbGrades;

        return [];
    } catch (err) {
        console.error('Error fetching user question grades:', err);
        return [];
    }
}

async function loadManifest(subject) {
    // runtime-fetch the build-time manifest produced at resources/markdown_questions/questions/<subject>/manifest_questions.json
    const url = `../resources/markdown_questions/questions/${subject}/manifest_questions.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function aggregateChapters(manifest, grades = []) {
    // manifest entries: { source, question, output, chapters: [] }
    const map = new Map();
    for (const item of manifest) {
        const chs = item.chapters || [];
        if (!chs.length) continue;
        for (const c of chs) {
            const current = map.get(c) || { name: c, count: 0, samples: [], attempted: 0 };
            current.count += 1;
            if (current.samples.length < 3) current.samples.push(item.output);
            map.set(c, current);
        }
    }
    // compute attempted counts by matching manifest entries to grades
    // build a lookup of graded questions for quick match
    const gradedSet = new Set();
    for (const g of grades) {
        try {
            const key = `${(g.subject||'').toString().toUpperCase()}|${(g.year||'').toString()}|${(g.session||'').toString().toLowerCase().slice(0,3)}|${(g.paper||'').toString()}|${(g.question||'').toString().toLowerCase().replace(/^q/,'')}`;
            gradedSet.add(key);
        } catch (e) {
            // ignore malformed grade entries
        }
    }

    // helper to normalize session tokens
    function normSess(s) { return (s||'').toString().toLowerCase().slice(0,3); }

    for (const item of manifest) {
        const out = item.output || '';
        const basename = out.split(/[\\/]/).pop() || '';
        // expect pattern: SUBJECT_SESSION_YEAR_Paper{paper}_Q{qnum}.md
        const m = basename.match(/([^_]+)_([^_]+)_(\d{4})_Paper(\d+)_Q(\d+)\.md$/i);
        if (!m) continue;
        const subj = m[1];
        const sess = m[2];
        const year = m[3];
        const paper = m[4];
        const qnum = m[5];
        const key = `${subj.toString().toUpperCase()}|${year}|${normSess(sess)}|${paper}|${qnum}`;
        const attempted = gradedSet.has(key);
        if (attempted && Array.isArray(item.chapters)) {
            for (const ch of item.chapters) {
                const cur = map.get(ch);
                if (cur) cur.attempted = (cur.attempted || 0) + 1;
            }
        }
    }
    // convert to list sorted by count desc
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
}

function renderChapters(chapters) {
    if (!chapters.length) {
        chaptersContainer.innerHTML = '<p style="color:#666; padding:1rem;">No chapter tagging was found for this subject.</p>';
        return;
    }
    chaptersContainer.innerHTML = '';
    for (const ch of chapters) {
        const div = document.createElement('div');
        div.className = 'subject-card';
        div.innerHTML = `
            <div class="subject-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 3H8C9.06087 3 10.0783 3.42143 10.8284 4.17157C11.5786 4.92172 12 5.93913 12 7V21C12 20.2044 11.6839 19.4413 11.1213 18.8787C10.5587 18.3161 9.79565 18 9 18H2V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 3H16C14.9391 3 13.9217 3.42143 13.1716 4.17157C12.4214 4.92172 12 5.93913 12 7V21C12 20.2044 12.3161 19.4413 12.8787 18.8787C13.4413 18.3161 14.2044 18 15 18H22V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="subject-main" style="flex:1; min-width:0;">
                <h2 class="subject-title">${ch.name}</h2>
                <p style="color:#666; margin-top:0.25rem; margin-bottom:0.25rem;">${ch.count} questions</p>
            </div>
            <div class="chapter-progress-wrap">
                <div class="chapter-progress"><div class="progress-fill" style="width: ${Math.round(((ch.attempted||0)/Math.max(1,ch.count))*100)}%;"></div></div>
                <div class="chapter-progress-text"><span>${ch.attempted||0} attempted</span><span>${ch.count} total</span></div>
            </div>
        `;
        div.addEventListener('click', () => openChapter(ch));
        chaptersContainer.appendChild(div);
    }
}

function openChapter(chapter) {
    // store in session and open a question-list view (reuse subject-papers.html or create lightweight view)
    sessionStorage.setItem('practice_chapter', chapter.name);
    sessionStorage.setItem('practice_chapter_samples', JSON.stringify(chapter.samples));
    // navigate to chapter questions list
    window.location.href = `chapter-questions.html?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter.name)}`;
}
