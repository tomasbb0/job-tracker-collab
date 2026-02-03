/**
 * JSearch API Scraper - FREE TIER (500 requests/month)
 * 
 * Aggregates jobs from: Google Jobs, LinkedIn, Indeed, Glassdoor, ZipRecruiter
 * Includes: Google, Meta, Microsoft, Apple, and 1000s of other companies!
 * 
 * SETUP:
 * 1. Go to: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * 2. Click "Subscribe to Test" (FREE - $0/month)
 * 3. Your existing RapidAPI key will work automatically
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const companies = require('./companies.json');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'a0f27b4bcbmsh3716826aad729aep1b603ejsnf3d59ecb4abf';
const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com';

const criteria = companies.filterCriteria;

// Target locations
const LOCATIONS = [
    'Dublin, Ireland',
    'London, United Kingdom', 
    'Amsterdam, Netherlands'
];

// Search queries for entry-level sales roles
const QUERIES = [
    'sales development representative',
    'business development representative', 
    'SDR',
    'BDR',
    'account executive entry level'
];

/**
 * Search jobs using JSearch API
 */
async function searchJobs(query, location, page = 1) {
    const url = new URL('https://jsearch.p.rapidapi.com/search');
    url.searchParams.set('query', `${query} in ${location}`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('num_pages', '1');
    url.searchParams.set('date_posted', 'week'); // Last 7 days
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            if (error.message?.includes('not subscribed')) {
                console.error('\n❌ Not subscribed to JSearch API!');
                console.error('   Go to: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch');
                console.error('   Click "Subscribe to Test" (FREE)\n');
                return [];
            }
            throw new Error(error.message || response.statusText);
        }
        
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`   Error searching "${query}" in ${location}:`, error.message);
        return [];
    }
}

/**
 * Quick filter by title (exclude senior/manager roles)
 */
function quickFilter(job) {
    const title = (job.job_title || '').toLowerCase();
    return !criteria.excludeRoleKeywords.some(kw => title.includes(kw.toLowerCase()));
}

/**
 * Extract experience from job data
 */
function getExperience(job) {
    const exp = job.job_required_experience || {};
    const months = exp.required_experience_in_months;
    if (months !== null && months !== undefined) {
        const years = Math.floor(months / 12);
        return `${years}-${years + 1}`;
    }
    // Check if it's entry level
    if (exp.experience_mentioned === false || 
        exp.experience_preferred === false ||
        exp.no_experience_required === true) {
        return '0-1';
    }
    return 'N/A';
}

/**
 * Main scraping function
 */
export async function scrapeJSearchJobs() {
    console.log('\n🔍 JSearch API - Scraping Google Jobs, LinkedIn, Indeed...\n');
    
    const allJobs = [];
    const seenIds = new Set();
    
    for (const location of LOCATIONS) {
        console.log(`📍 Searching ${location}...`);
        
        for (const query of QUERIES) {
            console.log(`   🔎 "${query}"...`);
            
            const jobs = await searchJobs(query, location);
            
            for (const job of jobs) {
                // Deduplicate
                if (seenIds.has(job.job_id)) continue;
                seenIds.add(job.job_id);
                
                // Quick filter
                if (!quickFilter(job)) continue;
                
                allJobs.push({
                    id: `jsearch_${job.job_id}`,
                    company: job.employer_name || 'Unknown',
                    role: job.job_title,
                    location: job.job_city ? `${job.job_city}, ${job.job_country}` : job.job_country || location,
                    yearsExp: getExperience(job),
                    link: job.job_apply_link || job.job_google_link,
                    description: job.job_description?.substring(0, 500) || '',
                    source: 'jsearch',
                    employer_logo: job.employer_logo,
                    posted: job.job_posted_at_datetime_utc,
                    is_remote: job.job_is_remote
                });
            }
            
            console.log(`      Found ${jobs.length} jobs`);
            
            // Rate limiting - be nice to the API
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    console.log(`\n✅ JSearch complete: ${allJobs.length} unique jobs found`);
    
    // Group by company
    const byCompany = {};
    allJobs.forEach(j => {
        byCompany[j.company] = (byCompany[j.company] || 0) + 1;
    });
    
    console.log('\nTop companies found:');
    Object.entries(byCompany)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([company, count]) => {
            console.log(`   ${company}: ${count} jobs`);
        });
    
    return allJobs;
}

/**
 * Test function
 */
async function test() {
    console.log('Testing JSearch API...');
    console.log('Make sure you\'ve subscribed at: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch\n');
    
    const jobs = await scrapeJSearchJobs();
    
    if (jobs.length > 0) {
        console.log('\n📋 Sample jobs:');
        jobs.slice(0, 10).forEach(j => {
            console.log(`\n🏢 ${j.company}: ${j.role}`);
            console.log(`   📍 ${j.location} | ⏳ ${j.yearsExp} years`);
            console.log(`   📎 ${j.link?.substring(0, 60)}...`);
        });
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test().catch(console.error);
}

export default { scrapeJSearchJobs };
