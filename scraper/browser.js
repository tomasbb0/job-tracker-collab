/**
 * Browser Automation Scraper (Tier 3 Companies)
 * Uses Puppeteer for companies with custom career sites
 * 
 * Companies: Google, Microsoft, Apple, Amazon, Meta, Tesla, TikTok, ByteDance, Salesforce
 * 
 * NOTE: These scrapers are less reliable than API-based scrapers
 * and may need updates if company websites change.
 */

import puppeteer from 'puppeteer';
import companies from './companies.json' assert { type: 'json' };

const TARGET_LOCATIONS = ['Dublin', 'London', 'Amsterdam', 'Madrid', 'Lisbon', 'EMEA', 'Europe'];
const criteria = companies.filterCriteria;

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
            '--disable-gpu'
        ]
    });
}

/**
 * Quick pre-filter to exclude obvious non-matches
 */
function quickPreFilter(job) {
    const title = job.role?.toLowerCase() || '';
    
    const hasExcludedKeyword = criteria.excludeRoleKeywords.some(keyword => 
        title.includes(keyword.toLowerCase())
    );
    
    return !hasExcludedKeyword;
}

/**
 * Scrape Google Careers
 * Uses their careers API endpoint
 */
async function scrapeGoogle(browser) {
    console.log('\n📋 Fetching jobs from Google...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        // Google uses a JSON API we can access
        for (const location of ['Dublin', 'London', 'Amsterdam']) {
            const url = `https://careers.google.com/api/v3/search/?company=Google&company=YouTube&employment_type=FULL_TIME&location=${location}&page_size=100&q=`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
                const content = await page.content();
                
                // Try to extract JSON from the response
                const jsonMatch = content.match(/\{[\s\S]*"jobs"[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const googleJobs = data.jobs || [];
                    
                    googleJobs.forEach(job => {
                        jobs.push({
                            id: `google_${job.id || Date.now()}`,
                            company: 'Google',
                            role: job.title,
                            location: job.locations?.join(', ') || location,
                            link: `https://careers.google.com/jobs/results/${job.id}`,
                            description: job.description || '',
                            source: 'browser'
                        });
                    });
                }
            } catch (e) {
                console.log(`   Google ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Google scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Meta Careers
 */
async function scrapeMeta(browser) {
    console.log('\n📋 Fetching jobs from Meta...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        // Meta careers search
        for (const location of ['Dublin', 'London']) {
            const url = `https://www.metacareers.com/jobs?offices[0]=${location}`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('[data-testid="job-list-card"]', { timeout: 10000 }).catch(() => {});
                
                // Extract job listings
                const pageJobs = await page.evaluate(() => {
                    const cards = document.querySelectorAll('[data-testid="job-list-card"]');
                    return Array.from(cards).map(card => {
                        const titleEl = card.querySelector('a');
                        const locationEl = card.querySelector('[data-testid="job-location"]');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: titleEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `meta_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'Meta',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   Meta ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Meta scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Amazon Jobs
 */
async function scrapeAmazon(browser) {
    console.log('\n📋 Fetching jobs from Amazon...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['Dublin', 'London', 'Amsterdam']) {
            // Amazon uses query params for location
            const url = `https://www.amazon.jobs/en/search?base_query=&loc_query=${location}&latitude=&longitude=&loc_group_id=&invalid_location=false&country=&city=&region=&county=`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('.job-tile', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const tiles = document.querySelectorAll('.job-tile');
                    return Array.from(tiles).map(tile => {
                        const titleEl = tile.querySelector('.job-title a');
                        const locationEl = tile.querySelector('.location-icon + span');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: titleEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `amazon_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'Amazon',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   Amazon ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Amazon scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Microsoft Careers
 */
async function scrapeMicrosoft(browser) {
    console.log('\n📋 Fetching jobs from Microsoft...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['Dublin', 'London', 'Amsterdam']) {
            const url = `https://jobs.careers.microsoft.com/global/en/search?l=en_us&pg=1&pgSz=50&lc=${location}`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('[data-automation-id="jobTitle"]', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const cards = document.querySelectorAll('.ms-List-cell');
                    return Array.from(cards).map(card => {
                        const titleEl = card.querySelector('[data-automation-id="jobTitle"] a');
                        const locationEl = card.querySelector('[data-automation-id="jobLocation"]');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: titleEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `microsoft_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'Microsoft',
                        role: job.title,
                        location: job.location || location,
                        link: job.link.startsWith('http') ? job.link : `https://jobs.careers.microsoft.com${job.link}`,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   Microsoft ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Microsoft scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Apple Jobs
 */
async function scrapeApple(browser) {
    console.log('\n📋 Fetching jobs from Apple...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['dublin', 'london']) {
            const url = `https://jobs.apple.com/en-us/search?location=${location}`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('.table--advanced-search__title', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const rows = document.querySelectorAll('tbody tr');
                    return Array.from(rows).map(row => {
                        const titleEl = row.querySelector('.table--advanced-search__title a');
                        const locationEl = row.querySelector('td:nth-child(2)');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: titleEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `apple_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'Apple',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   Apple ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Apple scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Tesla Careers
 */
async function scrapeTesla(browser) {
    console.log('\n📋 Fetching jobs from Tesla...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        // Tesla uses Greenhouse, so we can use their API
        const url = 'https://boards-api.greenhouse.io/v1/boards/tesla/jobs?content=true';
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            const teslaJobs = data.jobs || [];
            
            teslaJobs.forEach(job => {
                const loc = job.location?.name?.toLowerCase() || '';
                if (TARGET_LOCATIONS.some(l => loc.includes(l.toLowerCase()))) {
                    jobs.push({
                        id: `tesla_${job.id}`,
                        company: 'Tesla',
                        role: job.title,
                        location: job.location?.name || 'Unknown',
                        link: job.absolute_url,
                        description: job.content || '',
                        source: 'greenhouse'
                    });
                }
            });
        } catch (e) {
            console.log(`   Tesla error: ${e.message}`);
        }
        
        await page.close();
    } catch (error) {
        console.error('Tesla scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape TikTok/ByteDance Careers
 */
async function scrapeTikTok(browser) {
    console.log('\n📋 Fetching jobs from TikTok/ByteDance...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['Dublin', 'London']) {
            const url = `https://careers.tiktok.com/position?keywords=&category=&location=${location}`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('.position-list', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const cards = document.querySelectorAll('.position-item');
                    return Array.from(cards).map(card => {
                        const titleEl = card.querySelector('.position-name');
                        const locationEl = card.querySelector('.position-location');
                        const linkEl = card.querySelector('a');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: linkEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `tiktok_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'TikTok',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   TikTok ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('TikTok scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Scrape Salesforce Careers
 */
async function scrapeSalesforce(browser) {
    console.log('\n📋 Fetching jobs from Salesforce...');
    const jobs = [];
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        for (const location of ['Dublin', 'London']) {
            const url = `https://careers.salesforce.com/en/jobs/?search=&location=${location}`;
            
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('.card-job', { timeout: 10000 }).catch(() => {});
                
                const pageJobs = await page.evaluate(() => {
                    const cards = document.querySelectorAll('.card-job');
                    return Array.from(cards).map(card => {
                        const titleEl = card.querySelector('.card-job-title a');
                        const locationEl = card.querySelector('.card-job-location');
                        return {
                            title: titleEl?.textContent?.trim() || '',
                            link: titleEl?.href || '',
                            location: locationEl?.textContent?.trim() || ''
                        };
                    }).filter(j => j.title);
                });
                
                pageJobs.forEach(job => {
                    jobs.push({
                        id: `salesforce_${job.link?.split('/').pop() || Date.now()}`,
                        company: 'Salesforce',
                        role: job.title,
                        location: job.location || location,
                        link: job.link,
                        description: '',
                        source: 'browser'
                    });
                });
            } catch (e) {
                console.log(`   Salesforce ${location} error: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        await page.close();
    } catch (error) {
        console.error('Salesforce scraping error:', error.message);
    }
    
    const filtered = jobs.filter(quickPreFilter);
    console.log(`   Found ${jobs.length} jobs, ${filtered.length} after pre-filter`);
    return filtered;
}

/**
 * Main function to scrape all Tier 3 companies
 */
export async function scrapeBrowserJobs() {
    console.log('\n🌐 Scraping Tier 3 companies (browser automation)...');
    
    const allJobs = [];
    let browser = null;
    
    try {
        browser = await launchBrowser();
        
        // Run scrapers sequentially to avoid rate limiting
        const googleJobs = await scrapeGoogle(browser);
        allJobs.push(...googleJobs);
        
        const metaJobs = await scrapeMeta(browser);
        allJobs.push(...metaJobs);
        
        const amazonJobs = await scrapeAmazon(browser);
        allJobs.push(...amazonJobs);
        
        const microsoftJobs = await scrapeMicrosoft(browser);
        allJobs.push(...microsoftJobs);
        
        const appleJobs = await scrapeApple(browser);
        allJobs.push(...appleJobs);
        
        const teslaJobs = await scrapeTesla(browser);
        allJobs.push(...teslaJobs);
        
        const tiktokJobs = await scrapeTikTok(browser);
        allJobs.push(...tiktokJobs);
        
        const salesforceJobs = await scrapeSalesforce(browser);
        allJobs.push(...salesforceJobs);
        
    } catch (error) {
        console.error('Browser scraping error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    console.log(`\n✅ Browser scraping complete: ${allJobs.length} candidate jobs`);
    return allJobs;
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running browser scraper directly...');
    const jobs = await scrapeBrowserJobs();
    console.log('\nSample jobs:');
    jobs.slice(0, 10).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location})`);
    });
}

export default { scrapeBrowserJobs };
