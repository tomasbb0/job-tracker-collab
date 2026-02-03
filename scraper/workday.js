/**
 * Workday Career Sites Scraper
 * Fetches jobs from companies using Workday ATS
 * Uses Workday's public JSON endpoints
 */

import companies from './companies.json' assert { type: 'json' };

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Build Workday API URL for a company
 * Workday uses a consistent pattern for their career site APIs
 */
function buildWorkdayUrl(company, offset = 0, limit = 20) {
    // Workday API endpoints follow this pattern
    const baseUrls = {
        'SAP': 'https://jobs.sap.com/api/jobs',
        'Adobe': 'https://careers.adobe.com/us/en/search-results',
        'Cisco': 'https://jobs.cisco.com/jobs/SearchJobs',
        'ServiceNow': 'https://careers.servicenow.com/api/jobs',
        'NVIDIA': 'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs',
        'ASML': 'https://www.asml.com/en/careers/find-your-job'
    };
    
    return baseUrls[company.name] || null;
}

/**
 * Fetch jobs from NVIDIA (Workday-based)
 * NVIDIA has a clean Workday API we can use
 */
async function fetchNvidiaJobs(locations) {
    const url = 'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs';
    
    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: ""
    };
    
    const allJobs = [];
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`NVIDIA API error: ${response.status}`);
                break;
            }
            
            const data = await response.json();
            const jobs = data.jobPostings || [];
            
            // Filter by location
            const filtered = jobs.filter(job => {
                const loc = (job.locationsText || job.location || '').toLowerCase();
                return locations.some(l => loc.includes(l.toLowerCase()));
            });
            
            allJobs.push(...filtered.map(job => ({
                id: `workday_nvidia_${job.bulletFields?.[0] || job.title}`,
                company: 'NVIDIA',
                role: job.title,
                location: job.locationsText || job.location || 'Unknown',
                link: `https://nvidia.wd5.myworkdayjobs.com${job.externalPath}`,
                description: job.descriptionText || '',
                postedDate: job.postedOn,
                source: 'workday'
            })));
            
            payload.offset += payload.limit;
            hasMore = jobs.length === payload.limit && payload.offset < 500;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching NVIDIA jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Fetch jobs from ServiceNow (Workday-based)
 */
async function fetchServiceNowJobs(locations) {
    const url = 'https://servicenow.wd1.myworkdayjobs.com/wday/cxs/servicenow/Careers/jobs';
    
    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: ""
    };
    
    const allJobs = [];
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`ServiceNow API error: ${response.status}`);
                break;
            }
            
            const data = await response.json();
            const jobs = data.jobPostings || [];
            
            const filtered = jobs.filter(job => {
                const loc = (job.locationsText || job.location || '').toLowerCase();
                return locations.some(l => loc.includes(l.toLowerCase()));
            });
            
            allJobs.push(...filtered.map(job => ({
                id: `workday_servicenow_${job.bulletFields?.[0] || Date.now()}`,
                company: 'ServiceNow',
                role: job.title,
                location: job.locationsText || job.location || 'Unknown',
                link: `https://servicenow.wd1.myworkdayjobs.com${job.externalPath}`,
                description: job.descriptionText || '',
                postedDate: job.postedOn,
                source: 'workday'
            })));
            
            payload.offset += payload.limit;
            hasMore = jobs.length === payload.limit && payload.offset < 500;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching ServiceNow jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Fetch jobs from Cisco (Workday-based)
 */
async function fetchCiscoJobs(locations) {
    const url = 'https://cisco.wd5.myworkdayjobs.com/wday/cxs/cisco/External/jobs';
    
    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: ""
    };
    
    const allJobs = [];
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`Cisco API error: ${response.status}`);
                break;
            }
            
            const data = await response.json();
            const jobs = data.jobPostings || [];
            
            const filtered = jobs.filter(job => {
                const loc = (job.locationsText || job.location || '').toLowerCase();
                return locations.some(l => loc.includes(l.toLowerCase()));
            });
            
            allJobs.push(...filtered.map(job => ({
                id: `workday_cisco_${job.bulletFields?.[0] || Date.now()}`,
                company: 'Cisco',
                role: job.title,
                location: job.locationsText || job.location || 'Unknown',
                link: `https://cisco.wd5.myworkdayjobs.com${job.externalPath}`,
                description: job.descriptionText || '',
                postedDate: job.postedOn,
                source: 'workday'
            })));
            
            payload.offset += payload.limit;
            hasMore = jobs.length === payload.limit && payload.offset < 500;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching Cisco jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Fetch jobs from Adobe (Workday-based)
 */
async function fetchAdobeJobs(locations) {
    const url = 'https://adobe.wd5.myworkdayjobs.com/wday/cxs/adobe/external_experienced/jobs';
    
    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: ""
    };
    
    const allJobs = [];
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`Adobe API error: ${response.status}`);
                break;
            }
            
            const data = await response.json();
            const jobs = data.jobPostings || [];
            
            const filtered = jobs.filter(job => {
                const loc = (job.locationsText || job.location || '').toLowerCase();
                return locations.some(l => loc.includes(l.toLowerCase()));
            });
            
            allJobs.push(...filtered.map(job => ({
                id: `workday_adobe_${job.bulletFields?.[0] || Date.now()}`,
                company: 'Adobe',
                role: job.title,
                location: job.locationsText || job.location || 'Unknown',
                link: `https://adobe.wd5.myworkdayjobs.com${job.externalPath}`,
                description: job.descriptionText || '',
                postedDate: job.postedOn,
                source: 'workday'
            })));
            
            payload.offset += payload.limit;
            hasMore = jobs.length === payload.limit && payload.offset < 500;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching Adobe jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Fetch jobs from SAP (Workday-based)
 */
async function fetchSapJobs(locations) {
    const url = 'https://jobs.sap.com/api/jobs';
    
    const allJobs = [];
    
    try {
        // SAP has a different API structure
        for (const location of locations) {
            const response = await fetch(`${url}?location=${encodeURIComponent(location)}&limit=100`);
            
            if (!response.ok) {
                continue;
            }
            
            const data = await response.json();
            const jobs = data.jobs || data.results || [];
            
            allJobs.push(...jobs.map(job => ({
                id: `workday_sap_${job.id || job.req_id || Date.now()}`,
                company: 'SAP',
                role: job.title || job.name,
                location: job.location || location,
                link: job.url || job.apply_url || `https://jobs.sap.com/job/${job.id}`,
                description: job.description || '',
                postedDate: job.posted_date,
                source: 'workday'
            })));
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching SAP jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Fetch jobs from ASML
 */
async function fetchAsmlJobs(locations) {
    // ASML uses a custom career site, we'll try the Workday pattern
    const url = 'https://asml.wd3.myworkdayjobs.com/wday/cxs/asml/Careers/jobs';
    
    const payload = {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: ""
    };
    
    const allJobs = [];
    let hasMore = true;
    
    try {
        while (hasMore) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`ASML API error: ${response.status}`);
                break;
            }
            
            const data = await response.json();
            const jobs = data.jobPostings || [];
            
            const filtered = jobs.filter(job => {
                const loc = (job.locationsText || job.location || '').toLowerCase();
                return locations.some(l => loc.includes(l.toLowerCase()));
            });
            
            allJobs.push(...filtered.map(job => ({
                id: `workday_asml_${job.bulletFields?.[0] || Date.now()}`,
                company: 'ASML',
                role: job.title,
                location: job.locationsText || job.location || 'Unknown',
                link: `https://asml.wd3.myworkdayjobs.com${job.externalPath}`,
                description: job.descriptionText || '',
                postedDate: job.postedOn,
                source: 'workday'
            })));
            
            payload.offset += payload.limit;
            hasMore = jobs.length === payload.limit && payload.offset < 300;
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error('Error fetching ASML jobs:', error.message);
    }
    
    return allJobs;
}

/**
 * Quick pre-filter to exclude obvious non-matches
 */
function quickPreFilter(job, criteria) {
    const title = job.role?.toLowerCase() || '';
    
    const hasExcludedKeyword = criteria.excludeRoleKeywords.some(keyword => 
        title.includes(keyword.toLowerCase())
    );
    
    return !hasExcludedKeyword;
}

/**
 * Scrape all jobs from all Workday companies
 */
export async function scrapeWorkdayJobs() {
    const allJobs = [];
    const workdayCompanies = companies.workday;
    const criteria = companies.filterCriteria;
    
    console.log(`\n💼 Scraping ${workdayCompanies.length} Workday companies...`);
    
    // NVIDIA
    console.log('\n📋 Fetching jobs from NVIDIA...');
    const nvidiaJobs = await fetchNvidiaJobs(workdayCompanies.find(c => c.name === 'NVIDIA')?.locations || []);
    const nvidiaFiltered = nvidiaJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${nvidiaJobs.length} jobs, ${nvidiaFiltered.length} after pre-filter`);
    allJobs.push(...nvidiaFiltered);
    
    // ServiceNow
    console.log('\n📋 Fetching jobs from ServiceNow...');
    const serviceNowJobs = await fetchServiceNowJobs(workdayCompanies.find(c => c.name === 'ServiceNow')?.locations || []);
    const serviceNowFiltered = serviceNowJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${serviceNowJobs.length} jobs, ${serviceNowFiltered.length} after pre-filter`);
    allJobs.push(...serviceNowFiltered);
    
    // Cisco
    console.log('\n📋 Fetching jobs from Cisco...');
    const ciscoJobs = await fetchCiscoJobs(workdayCompanies.find(c => c.name === 'Cisco')?.locations || []);
    const ciscoFiltered = ciscoJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${ciscoJobs.length} jobs, ${ciscoFiltered.length} after pre-filter`);
    allJobs.push(...ciscoFiltered);
    
    // Adobe
    console.log('\n📋 Fetching jobs from Adobe...');
    const adobeJobs = await fetchAdobeJobs(workdayCompanies.find(c => c.name === 'Adobe')?.locations || []);
    const adobeFiltered = adobeJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${adobeJobs.length} jobs, ${adobeFiltered.length} after pre-filter`);
    allJobs.push(...adobeFiltered);
    
    // SAP
    console.log('\n📋 Fetching jobs from SAP...');
    const sapJobs = await fetchSapJobs(workdayCompanies.find(c => c.name === 'SAP')?.locations || []);
    const sapFiltered = sapJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${sapJobs.length} jobs, ${sapFiltered.length} after pre-filter`);
    allJobs.push(...sapFiltered);
    
    // ASML
    console.log('\n📋 Fetching jobs from ASML...');
    const asmlJobs = await fetchAsmlJobs(workdayCompanies.find(c => c.name === 'ASML')?.locations || []);
    const asmlFiltered = asmlJobs.filter(job => quickPreFilter(job, criteria));
    console.log(`   Found ${asmlJobs.length} jobs, ${asmlFiltered.length} after pre-filter`);
    allJobs.push(...asmlFiltered);
    
    console.log(`\n✅ Workday scraping complete: ${allJobs.length} candidate jobs`);
    return allJobs;
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Running Workday scraper directly...');
    const jobs = await scrapeWorkdayJobs();
    console.log('\nSample jobs:');
    jobs.slice(0, 5).forEach(job => {
        console.log(`- ${job.company}: ${job.role} (${job.location})`);
    });
}

export default { scrapeWorkdayJobs };
