/**
 * Firebase Integration Module
 * Handles reading/writing to Firebase Realtime Database
 */

import admin from 'firebase-admin';

let db = null;

/**
 * Initialize Firebase Admin SDK
 * Uses FIREBASE_SERVICE_ACCOUNT environment variable (JSON string)
 */
export function initFirebase() {
    if (db) return db;
    
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }
    
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON: ' + e.message);
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://job-tracker-tomas-default-rtdb.europe-west1.firebasedatabase.app"
    });
    
    db = admin.database();
    console.log('✅ Firebase initialized');
    return db;
}

/**
 * Get existing pending jobs
 * @returns {Promise<Object>} - Object with job IDs as keys
 */
export async function getPendingJobs() {
    if (!db) initFirebase();
    
    const snapshot = await db.ref('pending_jobs').once('value');
    return snapshot.val() || {};
}

/**
 * Get existing approved positions
 * @returns {Promise<Object>} - Object with position IDs as keys
 */
export async function getApprovedPositions() {
    if (!db) initFirebase();
    
    const snapshot = await db.ref('positions').once('value');
    return snapshot.val() || {};
}

/**
 * Check if a job already exists (in pending or approved)
 * Uses company + role + location as unique identifier
 * @param {Object} job - Job to check
 * @param {Object} existingPending - Existing pending jobs
 * @param {Object} existingApproved - Existing approved positions
 * @returns {boolean}
 */
export function jobExists(job, existingPending, existingApproved) {
    const signature = `${job.company.toLowerCase()}|${job.role.toLowerCase()}|${job.location.toLowerCase()}`;
    
    // Check pending jobs
    for (const pending of Object.values(existingPending)) {
        const pendingSig = `${(pending.company || '').toLowerCase()}|${(pending.role || '').toLowerCase()}|${(pending.location || '').toLowerCase()}`;
        if (pendingSig === signature) return true;
    }
    
    // Check approved positions
    for (const approved of Object.values(existingApproved)) {
        const approvedSig = `${(approved.company || '').toLowerCase()}|${(approved.role || '').toLowerCase()}|${(approved.location || '').toLowerCase()}`;
        if (approvedSig === signature) return true;
    }
    
    return false;
}

/**
 * Add jobs to pending_jobs collection
 * @param {Array} jobs - Array of job objects to add
 * @returns {Promise<number>} - Number of jobs added
 */
export async function addPendingJobs(jobs) {
    if (!db) initFirebase();
    
    // Get existing jobs to avoid duplicates
    const existingPending = await getPendingJobs();
    const existingApproved = await getApprovedPositions();
    
    let addedCount = 0;
    
    for (const job of jobs) {
        // Skip if already exists
        if (jobExists(job, existingPending, existingApproved)) {
            continue;
        }
        
        // Add to pending_jobs
        const pendingJob = {
            company: job.company,
            role: job.role,
            location: job.location,
            link: job.link,
            yearsExp: job.aiAnalysis?.years_required !== null 
                ? `${job.aiAnalysis.years_required}` 
                : '0-2',
            description: job.description?.substring(0, 500) || '',
            source: job.source,
            aiAnalysis: {
                isTechRole: job.aiAnalysis?.is_tech_role || false,
                yearsRequired: job.aiAnalysis?.years_required,
                isInternship: job.aiAnalysis?.is_internship || false,
                languagesRequired: job.aiAnalysis?.languages_required || [],
                confidence: job.aiAnalysis?.confidence || 0,
                reasoning: job.aiAnalysis?.reasoning || ''
            },
            scrapedAt: Date.now(),
            status: 'pending' // pending, approved, rejected
        };
        
        await db.ref('pending_jobs').push(pendingJob);
        addedCount++;
    }
    
    console.log(`✅ Added ${addedCount} new jobs to pending_jobs`);
    return addedCount;
}

/**
 * Approve a pending job (move to positions)
 * @param {string} pendingJobId - Firebase key of pending job
 * @returns {Promise<boolean>}
 */
export async function approvePendingJob(pendingJobId) {
    if (!db) initFirebase();
    
    const pendingRef = db.ref(`pending_jobs/${pendingJobId}`);
    const snapshot = await pendingRef.once('value');
    const job = snapshot.val();
    
    if (!job) {
        console.error(`Pending job ${pendingJobId} not found`);
        return false;
    }
    
    // Create approved position
    const position = {
        company: job.company,
        role: job.role,
        location: job.location,
        link: job.link,
        yearsExp: job.yearsExp,
        status: 'not-started',
        notes: `AI: ${job.aiAnalysis?.reasoning || 'Approved from scraper'}`,
        priority: false,
        createdAt: Date.now()
    };
    
    // Add to positions
    await db.ref('positions').push(position);
    
    // Remove from pending
    await pendingRef.remove();
    
    return true;
}

/**
 * Reject a pending job
 * @param {string} pendingJobId - Firebase key of pending job
 * @returns {Promise<boolean>}
 */
export async function rejectPendingJob(pendingJobId) {
    if (!db) initFirebase();
    
    await db.ref(`pending_jobs/${pendingJobId}`).remove();
    return true;
}

/**
 * Approve all pending jobs
 * @returns {Promise<number>} - Number approved
 */
export async function approveAllPendingJobs() {
    if (!db) initFirebase();
    
    const pending = await getPendingJobs();
    let count = 0;
    
    for (const id of Object.keys(pending)) {
        await approvePendingJob(id);
        count++;
    }
    
    return count;
}

/**
 * Reject all pending jobs
 * @returns {Promise<number>} - Number rejected
 */
export async function rejectAllPendingJobs() {
    if (!db) initFirebase();
    
    const pending = await getPendingJobs();
    let count = 0;
    
    for (const id of Object.keys(pending)) {
        await rejectPendingJob(id);
        count++;
    }
    
    return count;
}

/**
 * Log scrape history
 * @param {Object} stats - Scrape statistics
 */
export async function logScrapeHistory(stats) {
    if (!db) initFirebase();
    
    await db.ref('scrape_history').push({
        timestamp: Date.now(),
        ...stats
    });
}

export default {
    initFirebase,
    getPendingJobs,
    getApprovedPositions,
    addPendingJobs,
    approvePendingJob,
    rejectPendingJob,
    approveAllPendingJobs,
    rejectAllPendingJobs,
    logScrapeHistory
};
