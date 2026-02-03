/**
 * Browser Automation Scraper (Tier 3 Companies)
 * Uses Puppeteer with PARALLEL browser instances for speed
 * 
 * Companies: Google, Microsoft, Apple, Amazon, Meta, Salesforce, LinkedIn
 */

import puppeteer from 'puppeteer';
import os from 'os';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const companies = require('./companies.json');

const TARGET_LOCATIONS = ['Dublin', 'London', 'Amsterdam', 'Madrid', 'Lisbon', 'EMEA', 'Europe', 'Ireland', 'UK', 'United Kingdom'];
const criteria = companies.filterCriteria;

// Determine max parallel browsers based on available RAM
const totalRAM = os.totalmem() / (1024 * 1024 * 1024); // GB
const MAX_PARALLEL_BROWSERS = Math.min(Math.floor(totalRAM / 2), 4); // 2GB per browser, max 4

console.log(`System RAM: ${totalRAM.toFixed(1)}GB - Using up to ${MAX_PARALLEL_BROWSERS} parallel browsers`);

/**
 * Launch browser with stealth settings
 */
async function launchBrowser() {
    return puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    });
}

/**
 * Quick pre-filter by title
 */
function quickPreFilter(job) {
    const title = job.role?.toLowerCase() || '';
    return !criteria.excludeRoleKeywords.some(keyword => title.includes(keyword.toLowerCase()));
}

/**
 * Extract years from description
 */
function extractYearsRequired(text) {
    if (!text) return null;
    const match = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
    return match ? parseInt(match[1]) : null;
}

/**
 * Scrape Google Careers - Using their actual search page
 */
async function scrapeGoogle() {
    console.log('\n📋 Fetching jobs from Google...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Use Google's actual careers search with sales/business roles
        const searchQueries = [
            'sales development',
            'business development',
            'account executive',
            'customer success'
        ];
        
        for (const query of searchQueries) {
            for (const location of ['Dublin', 'London']) {
                const url = `https://www.google.com/about/careers/applications/jobs/results/?location=${location}&q=${encodeURIComponent(query)}`;
                
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('[data-id]', { timeout: 8000 }).catch(() => {});
                    
                    // Extract job cards
                    const pageJobs = await page.evaluate(() => {
                        const results = [];
                        // Try multiple selector strategies
                        const cards = document.querySelectorAll('[data-id], .gc-card, [role="listitem"]');
                        
                        cards.forEach(card => {
                            const titleEl = card.querySelector('h3, [data-title], .gc-card__title');
                            const linkEl = card.querySelector('a[href*="jobs/results"]');
                            const locationEl = card.querySelector('[data-location], .gc-card__location');
                            
                            if (titleEl && linkEl) {
                                results.push({
                                    title: titleEl.textContent?.trim() || '',
                                    link: linkEl.href || '',
                                    location: locationEl?.textContent?.trim() || ''
                                });
                            }
                        });
                        return results;
                    });
                    
                    pageJobs.forEach(job => {
                        if (job.title && !jobs.find(j => j.link === job.link)) {
                            jobs.push({
                                id: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                company: 'Google',
                                role: job.title,
                                location: job.location || location,
                                link: job.link,
                                description: '',
                                source: 'browser'
                            });
                        }
                    });
                    
                    console.log(`   Google ${location}/${query}: found ${pageJobs.length} jobs`);
                } catch (e) {
                    console.log(`   Google ${location}/${query} error: ${e.message.substring(0, 50)}`);
                }
                
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        
        await browser.close();
    } catch (error) {
        console.error('Google scraping error:', error.message);
        if (browser) await browser.close();
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Google total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Scrape Meta/Facebook Careers - Updated selectors
 */
async function scrapeMeta() {
    console.log('\n📋 Fetching jobs from Meta...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        // Meta's careers API endpoint
        for (const location of ['dublin', 'london']) {
            const url = `https://www.metacareers.com/jobs?location[0]=${location}&teams[0]=Sales`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                
                // Wait for job cards to load
                await page.waitForFunction(() => {
                    return document.querySelectorAll('a[href*="/jobs/"]').length > 0;
                }, { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const results = [];
                    const links = document.querySelectorAll('a[href*="/jobs/"]');
                    
                    links.forEach(link => {
                        const href = link.href;
                        if (href && href.includes('/jobs/') && !href.includes('/jobs?')) {
                            const titleEl = link.querySelector('div[role="heading"], span, div');
                            results.push({
                                title: titleEl?.textContent?.trim() || link.textContent?.trim() || '',
                                link: href
                            });
                        }
                    });
                    return results.filter(j => j.title && j.title.length > 5);
                });
                
                pageJobs.forEach(job => {
                    if (!jobs.find(j => j.link === job.link)) {
                        jobs.push({
                            id: `meta_${job.link.split('/').pop()}`,
                            company: 'Meta',
                            role: job.title,
                            location: location.charAt(0).toUpperCase() + location.slice(1),
                            link: job.link,
                            description: '',
                            source: 'browser'
                        });
                    }
                });
                
                console.log(`   Meta ${location}: found ${pageJobs.length} jobs`);
            } catch (e) {
                console.log(`   Meta ${location} error: ${e.message.substring(0, 50)}`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        }
        
        await browser.close();
    } catch (error) {
        console.error('Meta scraping error:', error.message);
        if (browser) await browser.close();
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Meta total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Scrape Microsoft Careers - Using their API
 */
async function scrapeMicrosoft() {
    console.log('\n📋 Fetching jobs from Microsoft...');
    const jobs = [];
    
    try {
        // Microsoft has a public API we can use directly
        for (const location of ['Dublin', 'London', 'Amsterdam']) {
            const url = `https://gcsservices.careers.microsoft.com/search/api/v1/search?l=en_us&pg=1&pgSz=100&o=Relevance&flt=true&loc=${encodeURIComponent(location)}`;
            
            try {
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const jobList = data.operationResult?.result?.jobs || [];
                    
                    jobList.forEach(job => {
                        const title = job.title?.toLowerCase() || '';
                        // Only sales/BD roles
                        if (title.includes('sales') || title.includes('business development') || title.includes('account') || title.includes('customer success')) {
                            jobs.push({
                                id: `microsoft_${job.jobId}`,
                                company: 'Microsoft',
                                role: job.title,
                                location: job.properties?.primaryLocation || location,
                                link: `https://jobs.careers.microsoft.com/global/en/job/${job.jobId}`,
                                description: job.description || '',
                                source: 'api'
                            });
                        }
                    });
                    
                    console.log(`   Microsoft ${location}: found ${jobList.length} total, ${jobs.length} sales roles`);
                }
            } catch (e) {
                console.log(`   Microsoft ${location} error: ${e.message.substring(0, 50)}`);
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (error) {
        console.error('Microsoft scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Microsoft total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Scrape Amazon Jobs - Using their API
 */
async function scrapeAmazon() {
    console.log('\n📋 Fetching jobs from Amazon...');
    const jobs = [];
    
    try {
        for (const location of ['dublin', 'london', 'amsterdam']) {
            const url = `https://www.amazon.jobs/en/search.json?base_query=sales&loc_query=${location}&category[]=sales-advertising-account-management&category[]=business-development&offset=0&result_limit=100`;
            
            try {
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const jobList = data.jobs || [];
                    
                    jobList.forEach(job => {
                        jobs.push({
                            id: `amazon_${job.id_icims}`,
                            company: 'Amazon',
                            role: job.title,
                            location: job.city || location,
                            link: `https://www.amazon.jobs${job.job_path}`,
                            description: job.description_short || '',
                            source: 'api'
                        });
                    });
                    
                    console.log(`   Amazon ${location}: found ${jobList.length} jobs`);
                }
            } catch (e) {
                console.log(`   Amazon ${location} error: ${e.message.substring(0, 50)}`);
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (error) {
        console.error('Amazon scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Amazon total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Scrape LinkedIn Jobs - Public search
 */
async function scrapeLinkedIn() {
    console.log('\n📋 Fetching jobs from LinkedIn...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['Dublin', 'London']) {
            // LinkedIn public job search (no login required)
            const url = `https://www.linkedin.com/jobs/search/?keywords=sales%20development&location=${encodeURIComponent(location)}&f_E=2&f_TPR=r604800`;
            
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForSelector('.jobs-search__results-list', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const results = [];
                    const cards = document.querySelectorAll('.base-card, .job-search-card');
                    
                    cards.forEach(card => {
                        const titleEl = card.querySelector('.base-search-card__title, .job-search-card__title');
                        const companyEl = card.querySelector('.base-search-card__subtitle, .job-search-card__subtitle');
                        const linkEl = card.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
                        const locationEl = card.querySelector('.job-search-card__location');
                        
                        if (titleEl && linkEl) {
                            results.push({
                                title: titleEl.textContent?.trim() || '',
                                company: companyEl?.textContent?.trim() || 'LinkedIn',
                                link: linkEl.href?.split('?')[0] || '',
                                location: locationEl?.textContent?.trim() || ''
                            });
                        }
                    });
                    return results;
                });
                
                pageJobs.forEach(job => {
                    if (!jobs.find(j => j.link === job.link)) {
                        jobs.push({
                            id: `linkedin_${job.link.split('/').pop()}`,
                            company: job.company || 'LinkedIn',
                            role: job.title,
                            location: job.location || location,
                            link: job.link,
                            description: '',
                            source: 'browser'
                        });
                    }
                });
                
                console.log(`   LinkedIn ${location}: found ${pageJobs.length} jobs`);
            } catch (e) {
                console.log(`   LinkedIn ${location} error: ${e.message.substring(0, 50)}`);
            }
            
            await new Promise(r => setTimeout(r, 3000));
        }
        
        await browser.close();
    } catch (error) {
        console.error('LinkedIn scraping error:', error.message);
        if (browser) await browser.close();
    }
    
    console.log(`   ✅ LinkedIn total: ${jobs.length} jobs`);
    return jobs;
}

/**
 * Scrape Salesforce Careers - Updated API
 */
async function scrapeSalesforce() {
    console.log('\n📋 Fetching jobs from Salesforce...');
    const jobs = [];
    
    try {
        // Salesforce careers API
        const url = 'https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/Futureforce_Internships/jobs';
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                appliedFacets: {},
                limit: 100,
                offset: 0,
                searchText: 'sales'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const jobList = data.jobPostings || [];
            
            jobList.forEach(job => {
                const loc = job.locationsText?.toLowerCase() || '';
                if (TARGET_LOCATIONS.some(l => loc.includes(l.toLowerCase()))) {
                    jobs.push({
                        id: `salesforce_${job.bulletFields?.[0] || Date.now()}`,
                        company: 'Salesforce',
                        role: job.title,
                        location: job.locationsText || 'Unknown',
                        link: `https://salesforce.wd12.myworkdayjobs.com${job.externalPath}`,
                        description: '',
                        source: 'api'
                    });
                }
            });
            
            console.log(`   Salesforce: found ${jobs.length} jobs in target locations`);
        }
    } catch (error) {
        console.error('Salesforce scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Salesforce total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Main function - PARALLEL execution
 */
export async function scrapeBrowserJobs() {
    console.log('\n🌐 Scraping Tier 3 companies (PARALLEL mode)...');
    console.log(`   Max parallel browsers: ${MAX_PARALLEL_BROWSERS}`);
    
    // Define all scrapers
    const scrapers = [
        { name: 'Google', fn: scrapeGoogle },
        { name: 'Meta', fn: scrapeMeta },
        { name: 'Microsoft', fn: scrapeMicrosoft },
        { name: 'Amazon', fn: scrapeAmazon },
        { name: 'LinkedIn', fn: scrapeLinkedIn },
        { name: 'Salesforce', fn: scrapeSalesforce }
    ];
    
    const allJobs = [];
    
    // Run scrapers in batches based on MAX_PARALLEL_BROWSERS
    for (let i = 0; i < scrapers.length; i += MAX_PARALLEL_BROWSERS) {
        const batch = scrapers.slice(i, i + MAX_PARALLEL_BROWSERS);
        console.log(`\n🔄 Running batch: ${batch.map(s => s.name).join(', ')}`);
        
        const results = await Promise.allSettled(batch.map(s => s.fn()));
        
        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                allJobs.push(...result.value);
            } else {
                console.error(`   ❌ ${batch[idx].name} failed:`, result.reason?.message);
            }
        });
    }
    
    console.log(`\n✅ Browser scraping complete: ${allJobs.length} candidate jobs`);
    return allJobs;
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running browser scraper directly...');
    const jobs = await scrapeBrowserJobs();
    console.log('\nSample jobs:');
    jobs.slice(0, 15).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location})`);
    });
}

export default { scrapeBrowserJobs };
