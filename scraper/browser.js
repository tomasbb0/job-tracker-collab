/**
 * Browser Automation Scraper with STEALTH MODE
 * Uses puppeteer-extra with stealth plugin to bypass anti-bot detection
 * 
 * Companies: Google, Microsoft, Meta, Salesforce, LinkedIn
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import os from 'os';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const companies = require('./companies.json');

// Apply stealth plugin to avoid bot detection
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));

const TARGET_LOCATIONS = ['Dublin', 'London', 'Amsterdam', 'Madrid', 'Lisbon', 'EMEA', 'Europe', 'Ireland', 'UK'];
const criteria = companies.filterCriteria;

// Determine max parallel browsers based on available RAM
const totalRAM = os.totalmem() / (1024 * 1024 * 1024);
const MAX_PARALLEL_BROWSERS = Math.min(Math.floor(totalRAM / 2), 4);

console.log(`System RAM: ${totalRAM.toFixed(1)}GB - Using up to ${MAX_PARALLEL_BROWSERS} parallel browsers`);

/**
 * Launch stealth browser with human-like settings
 */
async function launchStealthBrowser() {
    return puppeteerExtra.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    });
}

/**
 * Add human-like delays
 */
function humanDelay(min = 1000, max = 3000) {
    return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

/**
 * Setup page with human-like behavior
 */
async function setupHumanPage(browser) {
    const page = await browser.newPage();
    
    // Randomize user agent
    const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    // Override navigator properties to appear more human
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    });
    
    return page;
}

/**
 * Quick pre-filter by title
 */
function quickPreFilter(job) {
    const title = job.role?.toLowerCase() || '';
    return !criteria.excludeRoleKeywords.some(keyword => title.includes(keyword.toLowerCase()));
}

/**
 * Scrape Google Careers with Stealth Mode
 */
async function scrapeGoogle() {
    console.log('\n📋 Fetching jobs from Google (STEALTH MODE)...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchStealthBrowser();
        const page = await setupHumanPage(browser);
        
        for (const location of ['Dublin, Ireland', 'London, UK']) {
            // Go to Google Careers main page first (looks more human)
            await page.goto('https://www.google.com/about/careers/applications/', { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            await humanDelay(2000, 4000);
            
            // Now navigate to search with sales keywords
            const searchUrl = `https://www.google.com/about/careers/applications/jobs/results/?location=${encodeURIComponent(location)}&q=sales%20development`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await humanDelay(2000, 3000);
            
            // Wait for job cards to load
            await page.waitForSelector('[data-id], .gc-card, [role="listitem"]', { timeout: 15000 }).catch(() => {
                console.log(`   Google ${location}: No job cards found with selectors`);
            });
            
            // Scroll to load more jobs (human behavior)
            await page.evaluate(async () => {
                for (let i = 0; i < 3; i++) {
                    window.scrollBy(0, 500);
                    await new Promise(r => setTimeout(r, 500));
                }
            });
            await humanDelay(1000, 2000);
            
            // Extract jobs with multiple selector strategies
            const pageJobs = await page.evaluate(() => {
                const results = [];
                
                // Strategy 1: data-id cards
                document.querySelectorAll('[data-id]').forEach(card => {
                    const titleEl = card.querySelector('h3, [data-title]');
                    const linkEl = card.querySelector('a');
                    const locationEl = card.querySelector('[data-location], .gc-card__location');
                    if (titleEl && linkEl) {
                        results.push({
                            title: titleEl.textContent?.trim(),
                            link: linkEl.href,
                            location: locationEl?.textContent?.trim() || ''
                        });
                    }
                });
                
                // Strategy 2: gc-card elements
                if (results.length === 0) {
                    document.querySelectorAll('.gc-card').forEach(card => {
                        const titleEl = card.querySelector('.gc-card__title');
                        const linkEl = card.querySelector('a');
                        if (titleEl && linkEl) {
                            results.push({
                                title: titleEl.textContent?.trim(),
                                link: linkEl.href,
                                location: ''
                            });
                        }
                    });
                }
                
                // Strategy 3: Look for any job-like links
                if (results.length === 0) {
                    document.querySelectorAll('a[href*="/jobs/results/"]').forEach(link => {
                        const title = link.textContent?.trim();
                        if (title && title.length > 10 && !results.find(r => r.link === link.href)) {
                            results.push({ title, link: link.href, location: '' });
                        }
                    });
                }
                
                return results.filter(j => j.title);
            });
            
            pageJobs.forEach(job => {
                if (!jobs.find(j => j.link === job.link)) {
                    jobs.push({
                        id: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        company: 'Google',
                        role: job.title,
                        location: job.location || location.split(',')[0],
                        link: job.link,
                        description: '',
                        source: 'browser-stealth'
                    });
                }
            });
            
            console.log(`   Google ${location}: found ${pageJobs.length} jobs`);
            await humanDelay(3000, 5000);
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
 * Scrape Meta Careers with Stealth Mode
 */
async function scrapeMeta() {
    console.log('\n📋 Fetching jobs from Meta (STEALTH MODE)...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchStealthBrowser();
        const page = await setupHumanPage(browser);
        
        // Accept cookies if prompted
        const acceptCookies = async () => {
            try {
                const cookieBtn = await page.$('button[data-cookiebanner="accept_button"]');
                if (cookieBtn) await cookieBtn.click();
            } catch (e) {}
        };
        
        for (const office of ['Dublin%2C%20Ireland', 'London%2C%20United%20Kingdom']) {
            // Navigate to Meta careers with sales filter
            const url = `https://www.metacareers.com/jobs?offices[0]=${office}&teams[0]=Sales`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await acceptCookies();
            await humanDelay(3000, 5000);
            
            // Scroll to load jobs
            await page.evaluate(async () => {
                for (let i = 0; i < 5; i++) {
                    window.scrollBy(0, 400);
                    await new Promise(r => setTimeout(r, 800));
                }
            });
            await humanDelay(2000, 3000);
            
            // Extract jobs
            const pageJobs = await page.evaluate(() => {
                const results = [];
                
                // Look for job links
                document.querySelectorAll('a[href*="/jobs/"]').forEach(link => {
                    const href = link.href;
                    if (href && href.includes('/jobs/') && !href.includes('/jobs?') && !href.includes('/jobs/?')) {
                        // Get the job title from the link or parent element
                        let title = '';
                        const heading = link.querySelector('div[role="heading"], h3, span');
                        if (heading) {
                            title = heading.textContent?.trim();
                        } else {
                            title = link.textContent?.trim();
                        }
                        
                        if (title && title.length > 5 && title.length < 200) {
                            results.push({ title, link: href });
                        }
                    }
                });
                
                // Deduplicate
                const seen = new Set();
                return results.filter(j => {
                    if (seen.has(j.link)) return false;
                    seen.add(j.link);
                    return true;
                });
            });
            
            const locationName = office.includes('Dublin') ? 'Dublin' : 'London';
            pageJobs.forEach(job => {
                if (!jobs.find(j => j.link === job.link)) {
                    jobs.push({
                        id: `meta_${job.link.split('/').pop()}`,
                        company: 'Meta',
                        role: job.title,
                        location: locationName,
                        link: job.link,
                        description: '',
                        source: 'browser-stealth'
                    });
                }
            });
            
            console.log(`   Meta ${locationName}: found ${pageJobs.length} jobs`);
            await humanDelay(3000, 5000);
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
 * Scrape Microsoft Careers with Stealth Mode
 */
async function scrapeMicrosoft() {
    console.log('\n📋 Fetching jobs from Microsoft (STEALTH MODE)...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchStealthBrowser();
        const page = await setupHumanPage(browser);
        
        for (const location of ['Dublin', 'London']) {
            // Go to Microsoft careers search
            const url = `https://jobs.careers.microsoft.com/global/en/search?lc=${location}&l=en_us&pg=1&pgSz=50&o=Relevance&flt=true`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await humanDelay(3000, 5000);
            
            // Wait for job list
            await page.waitForSelector('[data-automation-id="jobTitle"], .ms-List-cell, [role="row"]', { timeout: 15000 }).catch(() => {});
            
            // Scroll to load more
            await page.evaluate(async () => {
                for (let i = 0; i < 5; i++) {
                    window.scrollBy(0, 500);
                    await new Promise(r => setTimeout(r, 600));
                }
            });
            await humanDelay(2000, 3000);
            
            // Extract jobs
            const pageJobs = await page.evaluate(() => {
                const results = [];
                
                // Strategy 1: data-automation-id elements
                document.querySelectorAll('[data-automation-id="jobTitle"]').forEach(el => {
                    const link = el.closest('a') || el.querySelector('a');
                    const locationEl = el.closest('[role="row"]')?.querySelector('[data-automation-id="jobLocation"]');
                    if (link) {
                        results.push({
                            title: el.textContent?.trim(),
                            link: link.href,
                            location: locationEl?.textContent?.trim() || ''
                        });
                    }
                });
                
                // Strategy 2: ms-List-cell
                if (results.length === 0) {
                    document.querySelectorAll('.ms-List-cell').forEach(cell => {
                        const titleLink = cell.querySelector('a');
                        if (titleLink) {
                            results.push({
                                title: titleLink.textContent?.trim(),
                                link: titleLink.href,
                                location: ''
                            });
                        }
                    });
                }
                
                // Strategy 3: Any job links
                if (results.length === 0) {
                    document.querySelectorAll('a[href*="/job/"], a[href*="/jobs/"]').forEach(link => {
                        const title = link.textContent?.trim();
                        if (title && title.length > 10) {
                            results.push({ title, link: link.href, location: '' });
                        }
                    });
                }
                
                return results.filter(j => j.title);
            });
            
            // Filter for sales/BD roles
            pageJobs.forEach(job => {
                const title = job.title?.toLowerCase() || '';
                if (title.includes('sales') || title.includes('business development') || 
                    title.includes('account') || title.includes('customer success')) {
                    if (!jobs.find(j => j.link === job.link)) {
                        jobs.push({
                            id: `microsoft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            company: 'Microsoft',
                            role: job.title,
                            location: job.location || location,
                            link: job.link.startsWith('http') ? job.link : `https://jobs.careers.microsoft.com${job.link}`,
                            description: '',
                            source: 'browser-stealth'
                        });
                    }
                }
            });
            
            console.log(`   Microsoft ${location}: found ${pageJobs.length} total, ${jobs.length} sales roles`);
            await humanDelay(3000, 5000);
        }
        
        await browser.close();
    } catch (error) {
        console.error('Microsoft scraping error:', error.message);
        if (browser) await browser.close();
    }
    
    console.log(`   ✅ Microsoft total: ${jobs.length} jobs`);
    return jobs;
}

/**
 * Scrape Amazon Jobs via API (no browser needed)
 */
async function scrapeAmazon() {
    console.log('\n📋 Fetching jobs from Amazon (API)...');
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
 * Scrape LinkedIn Jobs with Stealth Mode
 */
async function scrapeLinkedIn() {
    console.log('\n📋 Fetching jobs from LinkedIn (STEALTH MODE)...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchStealthBrowser();
        const page = await setupHumanPage(browser);
        
        for (const location of ['Dublin', 'London']) {
            // LinkedIn public job search
            const url = `https://www.linkedin.com/jobs/search/?keywords=sales%20development%20representative&location=${encodeURIComponent(location)}&f_E=2&f_TPR=r604800`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await humanDelay(3000, 5000);
            
            // Scroll to load more
            for (let i = 0; i < 5; i++) {
                await page.evaluate(() => window.scrollBy(0, 500));
                await humanDelay(800, 1200);
            }
            
            // Extract jobs
            const pageJobs = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('.base-card, .job-search-card, [data-entity-urn*="jobPosting"]').forEach(card => {
                    const titleEl = card.querySelector('.base-search-card__title, .job-search-card__title, h3');
                    const companyEl = card.querySelector('.base-search-card__subtitle, .job-search-card__subtitle, h4');
                    const linkEl = card.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
                    const locationEl = card.querySelector('.job-search-card__location, .base-search-card__metadata');
                    
                    if (titleEl && linkEl) {
                        results.push({
                            title: titleEl.textContent?.trim(),
                            company: companyEl?.textContent?.trim() || '',
                            link: linkEl.href?.split('?')[0],
                            location: locationEl?.textContent?.trim() || ''
                        });
                    }
                });
                return results;
            });
            
            pageJobs.forEach(job => {
                if (!jobs.find(j => j.link === job.link) && job.title) {
                    jobs.push({
                        id: `linkedin_${job.link?.split('/').pop() || Date.now()}`,
                        company: job.company || 'Unknown',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser-stealth'
                    });
                }
            });
            
            console.log(`   LinkedIn ${location}: found ${pageJobs.length} jobs`);
            await humanDelay(4000, 6000);
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
 * Scrape Salesforce Careers with Stealth Mode
 */
async function scrapeSalesforce() {
    console.log('\n📋 Fetching jobs from Salesforce (STEALTH MODE)...');
    const jobs = [];
    let browser;
    
    try {
        browser = await launchStealthBrowser();
        const page = await setupHumanPage(browser);
        
        for (const location of ['Dublin', 'London']) {
            const url = `https://careers.salesforce.com/en/jobs/?search=sales&location=${location}&pagesize=50`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await humanDelay(3000, 5000);
            
            // Wait for job cards
            await page.waitForSelector('.card-job, [data-job-id], .job-card', { timeout: 10000 }).catch(() => {});
            
            // Extract jobs
            const pageJobs = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('.card-job, [data-job-id], article').forEach(card => {
                    const titleEl = card.querySelector('.card-job-title a, h3 a, a[href*="/job/"]');
                    const locationEl = card.querySelector('.card-job-location, .job-location');
                    if (titleEl) {
                        results.push({
                            title: titleEl.textContent?.trim(),
                            link: titleEl.href,
                            location: locationEl?.textContent?.trim() || ''
                        });
                    }
                });
                return results;
            });
            
            pageJobs.forEach(job => {
                if (!jobs.find(j => j.link === job.link)) {
                    jobs.push({
                        id: `salesforce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        company: 'Salesforce',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser-stealth'
                    });
                }
            });
            
            console.log(`   Salesforce ${location}: found ${pageJobs.length} jobs`);
            await humanDelay(3000, 5000);
        }
        
        await browser.close();
    } catch (error) {
        console.error('Salesforce scraping error:', error.message);
        if (browser) await browser.close();
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   ✅ Salesforce total: ${filtered.length} jobs`);
    return filtered;
}

/**
 * Main function - PARALLEL execution with stealth
 */
export async function scrapeBrowserJobs() {
    console.log('\n🌐 Scraping with STEALTH MODE (parallel)...');
    console.log(`   Max parallel browsers: ${MAX_PARALLEL_BROWSERS}`);
    
    const scrapers = [
        { name: 'Google', fn: scrapeGoogle },
        { name: 'Meta', fn: scrapeMeta },
        { name: 'Microsoft', fn: scrapeMicrosoft },
        { name: 'Amazon', fn: scrapeAmazon },
        { name: 'LinkedIn', fn: scrapeLinkedIn },
        { name: 'Salesforce', fn: scrapeSalesforce }
    ];
    
    const allJobs = [];
    
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
    console.log('Running browser scraper with STEALTH MODE...');
    const jobs = await scrapeBrowserJobs();
    console.log('\nSample jobs:');
    jobs.slice(0, 15).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location})`);
    });
}

export default { scrapeBrowserJobs };
