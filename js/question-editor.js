import { themeManager } from './theme-manager.js';
import { attachSignOutHandler } from './signout-modal.js';

themeManager.init();
attachSignOutHandler('#signOutBtn');

const editor = document.getElementById('editor');
// preview element removed (we use a plain text editor now)
// questionTitle element is intentionally not used as the editor title anymore.
// The rendered markdown (which includes the '##' heading) will act as the title.
const questionTitle = document.getElementById('questionTitle');
let exportName = null; // friendly name used for exports (kept separate from UI)
const questionContent = document.getElementById('questionContent');
const timerEl = document.getElementById('timer');
const saveReviewBtn = document.getElementById('saveReview');

let draftKey = null;
let autoSaveTimer = null;
let countdownInterval = null;
let remainingSeconds = null;
let examMode = true; // when true, lock editor on expiry
let timerStarted = false; // ensure countdown starts on first typing

// Ensure the visible title element is empty; we rely on the rendered markdown for the title.
if (questionTitle) questionTitle.textContent = '';

// Minimal markdown renderer (very small subset)
function renderMarkdown(md) {
    if (!md) return '<p></p>';
    // escape HTML
    const esc = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // code fences
    let html = esc.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/\n/g,'\n')}</code></pre>`);
    // headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // bold/italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // unordered lists
    html = html.replace(/(^|\n)\s*[-\*+] (.*)/g, (m, p1, p2) => `\n<li>${p2}</li>`);
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    // paragraphs
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    // clean empty paragraph
    html = html.replace(/<p>\s*<\/p>/g,'');
    return html;
}

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

// Preformat a question markdown/body string before rendering.
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

function formatTime(s) {
    const mm = Math.floor(s/60).toString().padStart(2,'0');
    const ss = Math.floor(s%60).toString().padStart(2,'0');
    return `${mm}:${ss}`;
}

// Load selected question from sessionStorage
const sel = sessionStorage.getItem('selectedQuestion');
if (!sel) {
    questionContent.innerHTML = '<p style="color:#666;">Please choose a question from Practice → Chapter.</p>';
} else {
    const q = JSON.parse(sel);
    // Resolve the question markdown URL relative to this page.
    // Many manifest entries contain paths like 'resources/...' (root-relative),
    // but this page lives in `pages/` so we need to prefix '../' when necessary.
    let resolvedPath = q.output || '';
    if (resolvedPath && !resolvedPath.startsWith('/') && !resolvedPath.startsWith('../') && !resolvedPath.startsWith('./')) {
        resolvedPath = `../${resolvedPath}`;
    }
    const basename = (resolvedPath||'').split(/[\\/]/).pop()|| resolvedPath;
    // Use basename as the export name; we do not display a separate title element.
    exportName = basename;
    // Try multiple candidate paths for the markdown file to be robust against manifest path styles
    async function tryFetchCandidates(originalPath) {
        // Normalize slashes and strip leading ./ or ../
        const normalized = (originalPath || '').replace(/\\/g, '/');
        const raw = normalized.replace(/^(?:\.\/|(?:\.\.\/)+)*/, '');

        // Build candidate list in a pragmatic order that matches common dev server layouts:
        // 1) root-absolute stripped-top (e.g. '/resources/...')
        // 2) stripped-top (e.g. 'resources/...')
        // 3) raw manifest path (e.g. 'Actuarial-Exam-Book-main/resources/...')
        // 4) root-absolute raw (e.g. '/Actuarial-Exam-Book-main/...')
        // 5) page-relative variants ('../raw', './raw') as fallback
        const candidates = [];
        if (!raw) return null;
        // If raw contains a top-level folder, split it
        const topMatch = raw.match(/^([^\/]+)\/(.+)$/);
        if (topMatch) {
            const withoutTop = topMatch[2];
            candidates.push(`/${withoutTop}`);
            candidates.push(withoutTop);
        }
        // raw manifest path and its root-absolute form
        candidates.push(raw);
        candidates.push(`/${raw}`);
        // page-relative fallbacks (useful when manifest uses repo-relative paths)
        candidates.push(`../${raw}`);
        candidates.push(`./${raw}`);

        // De-duplicate preserving order
        const seen = new Set();
        const finalCandidates = [];
        for (const c of candidates) {
            if (!c) continue;
            if (!seen.has(c)) {
                seen.add(c);
                finalCandidates.push(c);
            }
        }

        for (let p of finalCandidates) {
            try {
                const encoded = encodeURI(p);
                const r = await fetch(encoded);
                if (!r.ok) continue; // try next candidate
                const contentType = r.headers.get('content-type') || '';
                const text = await r.text();
                const looksLikeHtmlError = contentType.includes('text/html') && /<title>\s*Error response\s*<\/title>/i.test(text);
                if (looksLikeHtmlError || text.includes('Error response') || text.includes('Nothing matches the given URI')) {
                    continue;
                }
                return { text, usedPath: p };
            } catch (err) {
                continue;
            }
        }
        return null;
    }

    tryFetchCandidates(resolvedPath).then(result => {
        if (!result) {
            console.error('Failed to fetch question file (all candidates exhausted) for', resolvedPath);
            questionContent.innerHTML = `<div style="color:#b91c1c; font-weight:600;">Question file not found.</div><div style="color:#666; margin-top:0.5rem;">Tried paths: ${[resolvedPath, `../${resolvedPath}`, `./${resolvedPath}`, `/${resolvedPath}`].join(', ')}</div>`;
            return;
        }

        const text = result.text;
        const usedPath = result.usedPath;
        try {
            const parsed = parseFrontmatter(text);
            // Derive a friendly title: prefer frontmatter.question, then frontmatter.title,
            // then the first level-2 heading (## ...), then fallback to the filename basename.
            let friendlyTitle = basename;
            if (parsed.frontmatter) {
                if (parsed.frontmatter.question) friendlyTitle = parsed.frontmatter.question;
                else if (parsed.frontmatter.title) friendlyTitle = parsed.frontmatter.title;
            }
            if (friendlyTitle === basename) {
                // try to extract first '## ' heading from the markdown body
                const h = parsed.body && parsed.body.match(/^##\s+(.*)$/m);
                if (h && h[1]) friendlyTitle = h[1].trim();
            }
            // store friendly title for export; do not display it separately.
            exportName = friendlyTitle;

            const formattedBody = preformatQuestionBody(parsed.body);
            questionContent.innerHTML = renderMarkdown(formattedBody);
            // setup timer from frontmatter
            const t = parsed.frontmatter && parsed.frontmatter.time_allocated_minutes ? parseFloat(parsed.frontmatter.time_allocated_minutes): null;
            if (t) {
                remainingSeconds = Math.round(t*60);
                timerEl.textContent = formatTime(remainingSeconds);
            } else {
                timerEl.textContent = '--:--';
            }
            // load draft
            draftKey = `draft_${basename}`;
            const saved = localStorage.getItem(draftKey);
            if (saved) editor.value = saved;
            // no preview - plain text editor
        } catch (err) {
            console.error('Failed to parse/render markdown', err);
            questionContent.innerHTML = '<div style="color:#b91c1c; font-weight:600;">Failed to render question content.</div>';
        }
    }).catch(err => {
        console.error('Unexpected error fetching question file', err);
        questionContent.innerHTML = '<div style="color:#b91c1c; font-weight:600;">Failed to load question content (network error).</div>';
    });
}

// Autosave (debounced) and start timer on first typing
editor.addEventListener('input', () => {
    if (!timerStarted && remainingSeconds) {
        // start the countdown on first real typing
        timerStarted = true;
        startCountdown();
    }
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (draftKey) localStorage.setItem(draftKey, editor.value);
    }, 1000);
});

// Save & Review button: persist draft and navigate to review page
if (saveReviewBtn) {
    saveReviewBtn.addEventListener('click', () => {
        if (draftKey) localStorage.setItem(draftKey, editor.value);
        // navigate to the chapter question grading/review page
        window.location.href = 'chapter-question-grading.html';
    });
}

// Timer controls
// No manual start/stop buttons. Timer starts automatically on first typing.

function startCountdown() {
    if (countdownInterval) return;
    countdownInterval = setInterval(() => {
        remainingSeconds = Math.max(0, remainingSeconds - 1);
        timerEl.textContent = formatTime(remainingSeconds);
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (examMode) {
                editor.disabled = true;
                alert('Time is up: editor locked (exam mode)');
            }
        }
    }, 1000);
}

// persist on unload
window.addEventListener('beforeunload', () => {
    if (draftKey) localStorage.setItem(draftKey, editor.value);
});

// preview removed: nothing to initialise for preview area

// expose simple save for debugging
window.__saveDraft = () => { if (draftKey) localStorage.setItem(draftKey, editor.value); };
