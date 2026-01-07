// memo-links.js (module)
// Imports canonical JSON and exports helpers used by other modules.
let examinersReportLinksMap = null;

export const ready = (async () => {
    try {
        const res = await fetch(new URL('../resources/pdfs/memo-links.json', import.meta.url));
        examinersReportLinksMap = await res.json();
    } catch (err) {
        console.error('Failed to load memo-links.json', err);
        examinersReportLinksMap = {};
    }
})();

function normalizeSession(session) {
    if (!session) return session;
    const s = String(session).toUpperCase();
    return s === 'OCTOBER' ? 'NOVEMBER' : s;
}

function getExaminersReportLink(subject, year, session, paper) {
    try {
        if (!subject || !year || !session) return null;
        if (!examinersReportLinksMap) return null;
        const sessionUpper = normalizeSession(session);
        const subj = examinersReportLinksMap[subject];
        if (!subj) return null;
        const yr = subj[year];
        if (!yr) return null;
        const sess = yr[sessionUpper];
        if (!sess) return null;
        const link = sess[paper] || sess['general'] || null;
        return link || null;
    } catch (err) {
        console.error('getExaminersReportLink error', err);
        return null;
    }
}

function hasExaminersReport(subject, year, session, paper) {
    const link = getExaminersReportLink(subject, year, session, paper);
    return link !== null && link !== undefined;
}

export { getExaminersReportLink, hasExaminersReport };