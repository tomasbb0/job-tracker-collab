/**
 * Greenhouse Job Board API Scraper
 * Fetches jobs from companies using Greenhouse ATS
 * NOW WITH DESCRIPTION-BASED EXPERIENCE FILTERING
 */

import { createRequire } from 'module'; const require = createRequire(import.meta.url); const companies = require('./companies.json');

const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Extract years of experience required from job description
 * @param {string} description - Job description text
 * @returns {number|null} - Years required or null if not found/entry-level
 */
function extractYearsRequired(description) {
    if (!description) return null;
    
    const text = description.toLowerCase();
    
    // Patterns to match experience requirements
    const patterns = [
        /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/gi,
        /(?:experience|exp)\s*(?:of)?\s*(\d+)\+?\s*(?:years?|yrs?)/gi,
        /(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)/gi,
        /minimum\s+(?:of\s+)?(\d+)\s*(?:years?|yrs?)/gi,
        /at\s+least\s+(\d+)\s*(?:years?|yrs?)/gi,
        /(\d+)\+?\s*(?:years?|yrs?)\s+(?:in|of|working)/gi,
    ];
    
    let maxYears = 0;
    let foundMatch = false;
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            foundMatch = true;
            // For ranges like "3-5 years", take the minimum
            const years = parseInt(match[1]) || parseInt(match[2]) || 0;
            if (years > maxYears) {
                maxYears = years;
            }
        }
    }
    
    // Check for "senior" or similar indicators
    if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('staff')) {
        if (maxYears < 5) maxYears = 5; // Assume senior = 5+ years
    }
    
    return foundMatch ? maxYears : null;
}

/**
 * Check if job requires languages other than English/Spanish/Portuguese
 * @param {string} description - Job description text
 * @returns {boolean} - True if requires other languages
 */
function requiresOtherLanguages(description) {
    if (!description) return false;
    
    const text = description.toLowerCase();
    
    // Languages that disqualify (not English/Spanish/Portuguese)
    const otherLanguages = [
        'german', 'deutsch', 'french', 'français', 'italian', 'italiano',
        'dutch', 'nederlands', 'polish', 'polski', 'czech', 'hungarian',
        'swedish', 'norwegian', 'danish', 'finnish', 'russian', 'russian',
        'japanese', '日本語', 'korean', '한국어', 'mandarin', 'cantonese',
        'chinese', '中文', 'arabic', 'hebrew', 'turkish', 'thai', 'vietnamese',
        'indonesian', 'bahasa', 'hindi'
    ];
    
    // Phrases indicating language requirement
    const requirementPhrases = [
        'fluent in', 'native speaker', 'fluency in', 'proficient in',
        'must speak', 'required language', 'language requirement',
        'speaking', 'written and spoken'
    ];
    
    for (const lang of otherLanguages) {
        for (const phrase of requirementPhrases) {
            if (text.includes(`${phrase} ${lang}`) || text.includes(`${lang} ${phrase}`)) {
                return true;
            }
        }
        // Also check if language appears near "required" or "must"
        const langIndex = text.indexOf(lang);
        if (langIndex !== -1) {
            const context = text.substring(Math.max(0, langIndex - 50), langIndex + 50);
            if (context.includes('required') || context.includes('must') || context.includes('essential') || context.includes('fluent')) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Fetch all jobs from a Greenhouse board with full content
 */
async function fetchGreenhouseJobs(boardToken) {
    const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs?content=true`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch jobs from ${boardToken}: ${response.status}`);
            return [];
        }
        return (await response.json()).jobs || [];
    } catch (error) {
        console.error(`Error fetching jobs from ${boardToken}:`, error.message);
        return [];
    }
}

/**
 * Check if job location matches target locations
 */
function matchesLocation(job, targetLocations) {
    const jobLocation = job.location?.name?.toLowerCase() || '';
    
    return targetLocations.some(loc => 
        jobLocation.includes(loc.toLowerCase()) ||
        (jobLocation.includes('remote') && 
         (jobLocation.includes('europe') || jobLocation.includes('emea') || jobLocation.includes('eu'))) ||
        jobLocation.includes('hybrid') ||
        jobLocation.includes('distributed')
    );
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Quick pre-filter by title (exclude obvious tech/intern)
 */
function quickPreFilter(job, criteria) {
    const title = job.title?.toLowerCase() || '';
    return !criteria.excludeRoleKeywords.some(keyword => title.includes(keyword.toLowerCase()));
}

/**
 * DEEP filter by description - check years of experience and language requirements
 */
function deepFilter(job, maxYears = 3) {
    const description = stripHtml(job.content);
    const title = job.title?.toLowerCase() || '';
    
    // Extract years required from description
    const yearsRequired = extractYearsRequired(description);
    
    // If years found and > maxYears, exclude
    if (yearsRequired !== null && yearsRequired > maxYears) {
        return { pass: false, reason: `Requires ${yearsRequired}+ years experience`, yearsRequired };
    }
    
    // Check for language requirements
    if (requiresOtherLanguages(description)) {
        return { pass: false, reason: 'Requires non-English/Spanish/Portuguese language', yearsRequired };
    }
    
    // Check title for senior indicators
    if (title.includes('senior') || title.includes('lead') || title.includes('principal') || title.includes('director') || title.includes('head of') || title.includes('vp ') || title.includes('vice president')) {
        return { pass: false, reason: 'Senior-level title', yearsRequired: yearsRequired || 5 };
    }
    
    return { pass: true, reason: 'Meets criteria', yearsRequired: yearsRequired || 0 };
}

/**
 * Transform Greenhouse job to standardized format
 */
function transformJob(job, companyName, filterResult) {
    return {
        id: `greenhouse_${job.id}`,
        company: companyName,
        role: job.title,
        location: job.location?.name || 'Unknown',
        link: job.absolute_url,
        description: stripHtml(job.content),
        yearsRequired: filterResult.yearsRequired,
        departments: job.departments?.map(d => d.name) || [],
        updatedAt: job.updated_at,
        source: 'greenhouse'
    };
}

/**
 * Scrape all jobs from all Greenhouse companies WITH DESCRIPTION FILTERING
 */
export async function scrapeGreenhouseJobs() {
    const allJobs = [];
    const greenhouseCompanies = companies.greenhouse;
    const criteria = companies.filterCriteria;
    
    console.log(`\n🌱 Scraping ${greenhouseCompanies.length} Greenhouse companies...`);
    
    for (const company of greenhouseCompanies) {
        console.log(`\n📋 Fetching jobs from ${company.name}...`);
        
        const jobs = await fetchGreenhouseJobs(company.boardToken);
        console.log(`   Found ${jobs.length} total jobs`);
        
        // Filter by location
        const locationFiltered = jobs.filter(job => matchesLocation(job, company.locations));
        console.log(`   ${locationFiltered.length} jobs in target locations`);
        
        // Quick pre-filter by title
        const preFiltered = locationFiltered.filter(job => quickPreFilter(job, criteria));
        console.log(`   ${preFiltered.length} jobs after title pre-filter`);
        
        // DEEP filter by description (years + languages)
        let deepFiltered = 0;
        let rejectedReasons = {};
        
        for (const job of preFiltered) {
            const filterResult = deepFilter(job, 3); // Max 3 years experience
            
            if (filterResult.pass) {
                allJobs.push(transformJob(job, company.name, filterResult));
                deepFiltered++;
            } else {
                rejectedReasons[filterResult.reason] = (rejectedReasons[filterResult.reason] || 0) + 1;
            }
        }
        
        console.log(`   ✅ ${deepFiltered} jobs after DEEP description filter`);
        if (Object.keys(rejectedReasons).length > 0) {
            console.log(`   ❌ Rejected reasons:`);
            for (const [reason, count] of Object.entries(rejectedReasons)) {
                console.log(`      - ${reason}: ${count}`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n✅ Greenhouse scraping complete: ${allJobs.length} VERIFIED entry-level jobs`);
    return allJobs;
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running Greenhouse scraper directly...');
    const jobs = await scrapeGreenhouseJobs();
    console.log('\nVerified entry-level jobs:');
    jobs.slice(0, 10).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location}) [${job.yearsRequired || 0} yrs]`);
    });
}

export default { scrapeGreenhouseJobs, fetchGreenhouseJobs, extractYearsRequired };
