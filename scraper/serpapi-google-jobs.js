/**
 * SerpApi Google Jobs Scraper - FREE 250 searches/month
 * 
 * Scrapes Google Jobs which aggregates listings from:
 * - Google Careers
 * - Meta Careers
 * - Microsoft Careers
 * - Apple Careers
 * - Amazon Jobs
 * - And thousands more!
 * 
 * SETUP:
 * 1. Sign up FREE: https://serpapi.com/users/sign_up?plan=free
 * 2. Get your API key from: https://serpapi.com/manage-api-key
 * 3. Set SERPAPI_KEY environment variable or paste below
 */

// Get API key from environment or paste it here
const SERPAPI_KEY = process.env.SERPAPI_KEY || 'YOUR_API_KEY_HERE';

/**
 * Search Google Jobs via SerpApi
 */
async function searchGoogleJobs(query, location) {
    const params = new URLSearchParams({
        engine: 'google_jobs',
        q: query,
        location: location,
        api_key: SERPAPI_KEY,
        hl: 'en',  // English
        chips: 'date_posted:week'  // Last 7 days
    });
    
    const url = `https://serpapi.com/search.json?${params}`;
    
    try {
        console.log(`   Searching: "${query}" in ${location}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`   Error: ${error}`);
            return [];
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error(`   API Error: ${data.error}`);
            return [];
        }
        
        return data.jobs_results || [];
    } catch (error) {
        console.error(`   Fetch error: ${error.message}`);
        return [];
    }
}

/**
 * Filter for entry-level sales roles
 */
function filterEntryLevel(jobs) {
    const excludeKeywords = [
        'senior', 'sr.', 'sr ', 'manager', 'director', 'head of', 
        'principal', 'lead', 'vp', 'vice president', 'chief', 'staff'
    ];
    
    const includeKeywords = [
        'sdr', 'bdr', 'sales development', 'business development',
        'account executive', 'account representative', 'sales rep'
    ];
    
    return jobs.filter(job => {
        const title = (job.title || '').toLowerCase();
        
        // Exclude senior roles
        if (excludeKeywords.some(kw => title.includes(kw))) {
            return false;
        }
        
        // Include if it's a sales role
        if (includeKeywords.some(kw => title.includes(kw))) {
            return true;
        }
        
        return true; // Include by default if not explicitly senior
    });
}

/**
 * Extract direct apply link from job
 */
function getApplyLink(job) {
    // Try to get direct apply link
    if (job.apply_options && job.apply_options.length > 0) {
        // Prefer company career site over LinkedIn
        const directApply = job.apply_options.find(opt => 
            !opt.link?.includes('linkedin.com') && 
            !opt.link?.includes('indeed.com')
        );
        if (directApply) return directApply.link;
        return job.apply_options[0].link;
    }
    
    // Fallback to share link
    return job.share_link || job.related_links?.[0]?.link || '';
}

/**
 * Main scraping function - optimized for 250 free searches
 */
export async function scrapeGoogleJobs() {
    console.log('\n🔍 SerpApi Google Jobs Scraper');
    console.log('   FREE tier: 250 searches/month\n');
    
    if (SERPAPI_KEY === 'YOUR_API_KEY_HERE') {
        console.error('❌ Please set your SERPAPI_KEY!');
        console.error('   Sign up FREE at: https://serpapi.com/users/sign_up?plan=free');
        console.error('   Then get your key at: https://serpapi.com/manage-api-key\n');
        return [];
    }
    
    // Targeted searches to maximize value from free tier
    // Each search costs 1 credit, so we use 6 total
    const searches = [
        // Big Tech in Dublin
        { query: 'SDR OR BDR Google OR Meta OR Microsoft', location: 'Dublin, Ireland' },
        { query: 'sales development representative', location: 'Dublin, Ireland' },
        { query: 'business development representative tech', location: 'Dublin, Ireland' },
        // Big Tech in London
        { query: 'SDR OR BDR Google OR Meta OR Microsoft', location: 'London, United Kingdom' },
        { query: 'sales development representative', location: 'London, United Kingdom' },
        { query: 'business development representative tech', location: 'London, United Kingdom' },
    ];
    
    const allJobs = [];
    const seenIds = new Set();
    
    for (const search of searches) {
        const jobs = await searchGoogleJobs(search.query, search.location);
        console.log(`   Found ${jobs.length} jobs`);
        
        for (const job of jobs) {
            // Dedupe by title + company
            const id = `${job.company_name}_${job.title}`.toLowerCase().replace(/\s+/g, '_');
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            
            allJobs.push({
                id: `serpapi_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                company: job.company_name || 'Unknown',
                role: job.title || 'Unknown Role',
                location: job.location || search.location,
                yearsExp: '0-2', // Filtered for entry-level
                link: getApplyLink(job),
                description: job.description?.substring(0, 500) || '',
                source: job.via || 'Google Jobs',
                posted: job.detected_extensions?.posted_at || 'Recent'
            });
        }
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Filter for entry-level
    const filtered = filterEntryLevel(allJobs);
    
    console.log(`\n✅ Total: ${filtered.length} entry-level jobs found`);
    
    // Group by company
    const byCompany = {};
    filtered.forEach(j => {
        byCompany[j.company] = (byCompany[j.company] || 0) + 1;
    });
    
    console.log('\n📊 Top companies:');
    Object.entries(byCompany)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([company, count]) => {
            console.log(`   ${company}: ${count} jobs`);
        });
    
    return filtered;
}

/**
 * Output results as JavaScript for HTML
 */
export function toJavaScript(jobs) {
    const jsArray = jobs.map(j => 
        `    { company: '${j.company.replace(/'/g, "\\'")}', role: '${j.role.replace(/'/g, "\\'")}', location: '${j.location.replace(/'/g, "\\'")}', yearsExp: '${j.yearsExp}', link: '${j.link}', notes: 'Source: ${j.source}' }`
    ).join(',\n');
    
    return `// Jobs from SerpApi Google Jobs (Google, Meta, Microsoft, etc.)\nconst GOOGLE_JOBS = [\n${jsArray}\n];`;
}

/**
 * Test function
 */
async function test() {
    console.log('Testing SerpApi Google Jobs...\n');
    
    const jobs = await scrapeGoogleJobs();
    
    if (jobs.length > 0) {
        console.log('\n📋 Sample jobs:');
        jobs.slice(0, 15).forEach(j => {
            console.log(`\n🏢 ${j.company}: ${j.role}`);
            console.log(`   📍 ${j.location}`);
            console.log(`   📎 ${j.link?.substring(0, 60)}...`);
        });
        
        // Check for big tech
        const bigTech = ['Google', 'Meta', 'Microsoft', 'Apple', 'Amazon'];
        console.log('\n🎯 Big Tech Check:');
        bigTech.forEach(company => {
            const count = jobs.filter(j => 
                j.company.toLowerCase().includes(company.toLowerCase())
            ).length;
            console.log(`   ${company}: ${count > 0 ? '✅' : '❌'} ${count} jobs`);
        });
    }
    
    return jobs;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    test().catch(console.error);
}

export default { scrapeGoogleJobs, toJavaScript };
