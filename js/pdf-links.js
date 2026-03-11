// pdf-links.js (module)
// Imports canonical JSON and exports helper functions used by other modules.
let pdfLinksMap = null;

// Load canonical JSON at runtime (fetch). Export `ready` so callers can await it.
export const ready = (async () => {
    try {
        const res = await fetch('/resources/pdfs/exam_links.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        pdfLinksMap = await res.json();
    } catch (err) {
        console.error('Failed to load exam_links.json', err);
        // Fallback: try import.meta.url relative path
        try {
            const res2 = await fetch(new URL('../resources/pdfs/exam_links.json', import.meta.url));
            if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
            pdfLinksMap = await res2.json();
        } catch (err2) {
            console.error('Fallback fetch also failed:', err2);
            pdfLinksMap = {};
        }
    }
})();

function normalizeSession(session) {
    if (!session) return session;
    const s = String(session).toUpperCase();
    return s === 'OCTOBER' ? 'NOVEMBER' : s;
}

function getPDFLink(subject, session, year, paper) {
    try {
        if (!subject || !session || !year || !paper) return null;
        if (!pdfLinksMap) return null;
        const sessionUpper = normalizeSession(session);
        const subj = pdfLinksMap[subject];
        if (!subj) return null;
        const sess = subj[sessionUpper];
        if (!sess) return null;
        const yr = sess[year];
        if (!yr) return null;
        const link = yr[paper];
        return link || null;
    } catch (err) {
        console.error('getPDFLink error', err);
        return null;
    }
}

function hasPDFLink(subject, session, year, paper) {
    const link = getPDFLink(subject, session, year, paper);
    return link !== null && link !== undefined;
}

export { getPDFLink, hasPDFLink };