/**
 * offline-sync.js
 *
 * Provides a unified grade-save helper and an automatic sync mechanism that
 * queues grades written while offline and flushes them to Firestore as soon
 * as connectivity is restored.
 *
 * Usage
 * -----
 * 1. Replace direct calls to firestoreData / indexedDBStorage in grading scripts
 *    with `saveGradeWithFallback(userId, gradingData)`.
 *
 * 2. Call `initOfflineSync(() => currentUser?.uid)` once after auth resolves.
 *    The function attaches a `window.online` listener and immediately attempts
 *    a flush if the browser is already online when called.
 */

import { firestoreData } from './firebase-data.js';
import { indexedDBStorage } from './indexeddb-storage.js';

/**
 * Save a grade to both Firestore (primary) and IndexedDB (local copy).
 * If Firestore is unreachable the grade is stored in IndexedDB with
 * `pendingSync: true` so it can be flushed later.
 *
 * @param {string} userId
 * @param {object} gradingData
 */
export async function saveGradeWithFallback(userId, gradingData) {
    let firestoreOk = false;

    try {
        await firestoreData.saveQuestionGrade(userId, gradingData);
        firestoreOk = true;
    } catch (err) {
        console.warn('[offline-sync] Firestore save failed, will queue for later sync:', err.message);
    }

    // Always persist locally. pendingSync reflects whether Firestore has it yet.
    try {
        await indexedDBStorage.saveQuestionGrade(userId, gradingData, !firestoreOk);
    } catch (idbErr) {
        console.error('[offline-sync] IndexedDB save also failed:', idbErr);
        if (!firestoreOk) {
            // Neither storage succeeded — surface the error to the caller
            throw new Error('Failed to save grading data to any storage.');
        }
    }

    if (!firestoreOk) {
        console.info('[offline-sync] Grade queued for sync when connection is restored.');
    }
}

/**
 * Push all locally-queued (pendingSync) grades to Firestore.
 * Called automatically on the `online` event and optionally on page load.
 *
 * @param {string} userId
 */
export async function flushPendingGrades(userId) {
    if (!userId) return;

    let pending;
    try {
        pending = await indexedDBStorage.getPendingSyncGrades(userId);
    } catch (err) {
        console.error('[offline-sync] Could not read pending grades from IndexedDB:', err);
        return;
    }

    if (!pending || pending.length === 0) return;

    console.info(`[offline-sync] Flushing ${pending.length} pending grade(s) to Firestore…`);

    let synced = 0;
    for (const grade of pending) {
        try {
            await firestoreData.saveQuestionGrade(userId, grade);
            await indexedDBStorage.markGradeSynced(grade.id);
            synced++;
        } catch (err) {
            // Leave pendingSync=true so it will be retried next time
            console.warn(`[offline-sync] Failed to sync grade ${grade.id}:`, err.message);
        }
    }

    if (synced > 0) {
        console.info(`[offline-sync] Successfully synced ${synced}/${pending.length} grade(s).`);
    }
}

/**
 * Cache grades fetched from Firestore into IndexedDB so they are available offline.
 * Any grade that has a pending (unsynced) local write is left untouched.
 *
 * Call this after every successful Firestore grade fetch.
 *
 * @param {string} userId
 * @param {object[]} grades
 */
export async function cacheGradesLocally(userId, grades) {
    if (!userId || !grades || grades.length === 0) return;
    try {
        await indexedDBStorage.seedGradeCache(userId, grades);
    } catch (err) {
        console.warn('[offline-sync] cacheGradesLocally error:', err);
    }
}

/**
 * Initialise the offline sync listener.
 * Call this once after authentication resolves.
 *
 * @param {() => string|null} getUserId  Function returning the current user's UID
 */
export function initOfflineSync(getUserId) {
    // Attempt an immediate flush in case grades were queued in a previous session
    if (navigator.onLine) {
        const uid = getUserId();
        if (uid) flushPendingGrades(uid).catch(() => {});
    }

    window.addEventListener('online', () => {
        const uid = getUserId();
        console.info('[offline-sync] Connection restored. Attempting to flush pending grades…');
        flushPendingGrades(uid).catch(() => {});
    });
}
