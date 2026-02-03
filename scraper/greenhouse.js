/**
 * Greenhouse Job Board API Scraper
 * Fetches jobs from companies using Greenhouse ATS
 * API is free and public - no authentication needed for GET requests
 */

import { createRequire } from 'module'; const require = createRequire(import.meta.url); const companies = require('./companies.json');

const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Fetch all jobs from a Greenhouse board
 * @param {string} boardToken - The company's Greenhouse board token
 * @returns {Promise<Array>} - Array of job objects
 */
async function fetchGreenhouseJobs(boardToken) {
    const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs?content=true`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Failed to fetch jobs from ${boardToken}: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        return data.jobs || [];
    } catch (error) {
        console.error(`Error fetching jobs from ${boardToken}:`, error.message);
        return [];
    }
}

/**
 * Fetch detailed job information including full description
 * @param {string} boardToken - The company's Greenhouse board token
 * @param {number} jobId - The job ID
 * @returns {Promise<Object|null>} - Detailed job object or null
 */
async function fetchJobDetails(boardToken, jobId) {
    const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs/${jobId}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching job details for ${jobId}:`, error.message);
        return null;
    }
}

/**
 * Check if a job location matches target locations
 * @param {Object} job - Job object with location
 * @param {Array<string>} targetLocations - Array of target location strings
 * @returns {boolean}
 */
function matchesLocation(job, targetLocations) {
    const jobLocation = job.location?.name?.toLowerCase() || '';
    
    return targetLocations.some(loc => 
        jobLocation.includes(loc.toLowerCase()) ||
        // Also check for remote roles in these regions
        (jobLocation.includes('remote') && 
         (jobLocation.includes('europe') || 
          jobLocation.includes('emea') ||
          jobLocation.includes('eu')))
    );
}

/**
 * Quick pre-filter to exclude obvious non-matches before AI analysis
 * @param {Object} job - Job object
 * @param {Object} criteria - Filter criteria from companies.json
 * @returns {boolean}
 */
function quickPreFilter(job, criteria) {
    const title = job.title?.toLowerCase() || '';
    
    // Exclude if title contains excluded keywords (obvious tech/intern roles)
    const hasExcludedKeyword = criteria.excludeRoleKeywords.some(keyword => 
        title.includes(keyword.toLowerCase())
    );
    
    if (hasExcludedKeyword) {
        return false;
    }
    
    return true;
}

/**
 * Transform Greenhouse job to standardized format
 * @param {Object} job - Greenhouse job object
 * @param {string} companyName - Company name
 * @returns {Object} - Standardized job object
 */
function transformJob(job, companyName) {
    // Extract plain text from HTML content
    const stripHtml = (html) => {
        if (!html) return '';
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    };
    
    return {
        id: `greenhouse_${job.id}`,
        company: companyName,
        role: job.title,
        location: job.location?.name || 'Unknown',
        link: job.absolute_url,
        description: stripHtml(job.content),
        departments: job.departments?.map(d => d.name) || [],
        updatedAt: job.updated_at,
        source: 'greenhouse',
        rawData: {
            greenhouseId: job.id,
            metadata: job.metadata || []
        }
    };
}

/**
 * Scrape all jobs from all Greenhouse companies
 * @returns {Promise<Array>} - Array of standardized job objects
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
        const locationFiltered = jobs.filter(job => 
            matchesLocation(job, company.locations)
        );
        console.log(`   ${locationFiltered.length} jobs in target locations`);
        
        // Quick pre-filter (exclude obvious tech/intern roles)
        const preFiltered = locationFiltered.filter(job => 
            quickPreFilter(job, criteria)
        );
        console.log(`   ${preFiltered.length} jobs after pre-filter (excluding obvious tech/intern)`);
        
        // Transform to standardized format
        const transformedJobs = preFiltered.map(job => 
            transformJob(job, company.name)
        );
        
        allJobs.push(...transformedJobs);
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n✅ Greenhouse scraping complete: ${allJobs.length} candidate jobs`);
    return allJobs;
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running Greenhouse scraper directly...');
    const jobs = await scrapeGreenhouseJobs();
    console.log('\nSample jobs:');
    jobs.slice(0, 5).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location})`);
    });
}

export default { scrapeGreenhouseJobs, fetchGreenhouseJobs, fetchJobDetails };
