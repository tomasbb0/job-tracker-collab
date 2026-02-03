#!/usr/bin/env node

/**
 * Job Scraper - Main Orchestrator
 * Scrapes jobs from all configured companies, filters with AI, and adds to Firebase
 */

import { scrapeGreenhouseJobs } from './greenhouse.js';
import { scrapeWorkdayJobs } from './workday.js';
import { scrapeBrowserJobs } from './browser.js';
import { fillMissingCompanies } from './serpapi-fallback.js';
import { filterJobsWithAI } from './ai-filter.js';
import { initFirebase, addPendingJobs, logScrapeHistory } from './firebase.js';

/**
 * Main scrape function
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   JOB SCRAPER - AI-Powered Job Discovery');
    console.log('   ' + new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════════════');
    
    const stats = {
        startTime: Date.now(),
        greenhouseJobs: 0,
        workdayJobs: 0,
        browserJobs: 0,
        totalScraped: 0,
        afterAiFilter: 0,
        newJobsAdded: 0,
        errors: []
    };
    
    try {
        // Initialize Firebase
        console.log('\n📦 Initializing Firebase...');
        initFirebase();
        
        // Scrape Greenhouse companies (Tier 1)
        console.log('\n' + '─'.repeat(60));
        console.log('TIER 1: GREENHOUSE COMPANIES');
        console.log('─'.repeat(60));
        
        let greenhouseJobs = [];
        try {
            greenhouseJobs = await scrapeGreenhouseJobs();
            stats.greenhouseJobs = greenhouseJobs.length;
        } catch (error) {
            console.error('Greenhouse scraping failed:', error.message);
            stats.errors.push({ source: 'greenhouse', error: error.message });
        }
        
        // Scrape Workday companies (Tier 2) - with timeout
        console.log('\n' + '─'.repeat(60));
        console.log('TIER 2: WORKDAY COMPANIES');
        console.log('─'.repeat(60));
        
        let workdayJobs = [];
        try {
            // Skip Workday if disabled (it can be slow/unreliable)
            if (process.env.SKIP_WORKDAY === 'true') {
                console.log('⏭️ Workday scraping disabled (SKIP_WORKDAY=true)');
            } else {
                // Add 2-minute timeout for Workday scraping
                const workdayPromise = scrapeWorkdayJobs();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Workday scraping timed out after 2 minutes')), 120000)
                );
                workdayJobs = await Promise.race([workdayPromise, timeoutPromise]);
                stats.workdayJobs = workdayJobs.length;
            }
        } catch (error) {
            console.error('Workday scraping failed:', error.message);
            stats.errors.push({ source: 'workday', error: error.message });
        }
        
        // Scrape Browser companies (Tier 3) - Optional, may fail
        console.log('\n' + '─'.repeat(60));
        console.log('TIER 3: BROWSER AUTOMATION (Custom Career Sites)');
        console.log('─'.repeat(60));
        
        let browserJobs = [];
        try {
            // Only run browser scraping if ENABLE_BROWSER_SCRAPING is set
            if (process.env.ENABLE_BROWSER_SCRAPING === 'true') {
                browserJobs = await scrapeBrowserJobs();
                stats.browserJobs = browserJobs.length;
            } else {
                console.log('⏭️ Browser scraping disabled (set ENABLE_BROWSER_SCRAPING=true to enable)');
            }
        } catch (error) {
            console.error('Browser scraping failed:', error.message);
            stats.errors.push({ source: 'browser', error: error.message });
        }
        
        // Combine all jobs
        let allJobs = [...greenhouseJobs, ...workdayJobs, ...browserJobs];
        stats.totalScraped = allJobs.length;
        
        // SerpApi fallback: ensure EVERY company returns at least 1 job (validation)
        const fallbackJobs = await fillMissingCompanies(allJobs);
        if (fallbackJobs.length > 0) {
            allJobs = [...allJobs, ...fallbackJobs];
            stats.totalScraped = allJobs.length;
            console.log(`\n   Added ${fallbackJobs.length} jobs via SerpApi fallback`);
        }
        
        console.log('\n' + '─'.repeat(60));
        console.log('AI FILTERING');
        console.log('─'.repeat(60));
        
        if (allJobs.length === 0) {
            console.log('⚠️ No jobs scraped to filter');
        } else {
            // Filter with AI
            const filteredJobs = await filterJobsWithAI(allJobs);
            stats.afterAiFilter = filteredJobs.length;
            
            // Add to Firebase pending_jobs
            console.log('\n' + '─'.repeat(60));
            console.log('ADDING TO FIREBASE');
            console.log('─'.repeat(60));
            
            const addedCount = await addPendingJobs(filteredJobs);
            stats.newJobsAdded = addedCount;
        }
        
        // Log scrape history
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;
        await logScrapeHistory(stats);
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        stats.errors.push({ source: 'main', error: error.message });
    }
    
    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('   SCRAPE SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Greenhouse jobs found:  ${stats.greenhouseJobs}`);
    console.log(`   Workday jobs found:     ${stats.workdayJobs}`);
    console.log(`   Browser jobs found:     ${stats.browserJobs}`);
    console.log(`   Total scraped:          ${stats.totalScraped}`);
    console.log(`   After AI filter:        ${stats.afterAiFilter}`);
    console.log(`   New jobs added:         ${stats.newJobsAdded}`);
    console.log(`   Duration:               ${Math.round(stats.duration / 1000)}s`);
    
    if (stats.errors.length > 0) {
        console.log(`\n   ⚠️ Errors: ${stats.errors.length}`);
        stats.errors.forEach(e => {
            console.log(`      - ${e.source}: ${e.error}`);
        });
    }
    
    console.log('═'.repeat(60));
    
    // Exit with error code if no jobs added and there were errors
    if (stats.newJobsAdded === 0 && stats.errors.length > 0) {
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
