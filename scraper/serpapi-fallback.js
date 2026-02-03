/**
 * SerpApi Fallback - Ensures EVERY company returns at least 1 job
 * Used when primary scrapers (Greenhouse, Workday, Browser) return 0 for a company
 */

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

const ALL_COMPANIES = [
    'Databricks', 'Airbnb', 'Stripe', 'Cloudflare', 'Twilio', 'HubSpot',
    'SAP', 'Adobe', 'Cisco', 'ServiceNow', 'NVIDIA', 'ASML',
    'Spotify', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta',
    'Tesla', 'TikTok', 'ByteDance', 'Salesforce'
];

/**
 * Fetch 1 job for a company via SerpApi Google Jobs
 */
async function fetchOneJobForCompany(companyName) {
    const query = `${companyName} jobs`;
    const location = 'Dublin, Ireland';
    
    const params = new URLSearchParams({
        engine: 'google_jobs',
        q: query,
        location: location,
        api_key: SERPAPI_KEY,
        hl: 'en'
    });
    
    try {
        const response = await fetch(`https://serpapi.com/search.json?${params}`);
        const data = await response.json();
        
        if (data.error || !data.jobs_results || data.jobs_results.length === 0) {
            return null;
        }
        
        const job = data.jobs_results[0];
        const link = job.apply_options?.[0]?.link || job.share_link || '';
        
        return {
            id: `serpapi_fallback_${companyName}_${Date.now()}`,
            company: job.company_name || companyName,
            role: job.title || 'Job',
            location: job.location || location,
            link: link,
            description: job.description?.substring(0, 500) || '',
            source: 'serpapi-fallback',
            via: job.via || 'Google Jobs'
        };
    } catch (error) {
        console.error(`   SerpApi error for ${companyName}:`, error.message);
        return null;
    }
}

function companyMatches(existingCompany, targetCompany) {
    const a = (existingCompany || '').toLowerCase();
    const b = (targetCompany || '').toLowerCase();
    return a.includes(b) || b.includes(a);
}

/**
 * For each company that has 0 jobs, fetch at least 1 via SerpApi
 */
export async function fillMissingCompanies(existingJobs) {
    const companiesWithJobs = new Set();
    for (const j of existingJobs) {
        for (const c of ALL_COMPANIES) {
            if (companyMatches(j.company, c)) companiesWithJobs.add(c);
        }
    }
    const missing = ALL_COMPANIES.filter(c => !companiesWithJobs.has(c));
    
    if (missing.length === 0) {
        console.log('\n✅ All companies have at least 1 job - no fallback needed');
        return [];
    }
    
    if (!SERPAPI_KEY) {
        console.log(`\n⚠️ SerpApi fallback skipped (set SERPAPI_KEY). ${missing.length} companies have 0 jobs: ${missing.join(', ')}`);
        return [];
    }
    
    console.log(`\n🔄 SerpApi fallback: fetching 1 job each for ${missing.length} companies: ${missing.join(', ')}`);
    
    const fallbackJobs = [];
    
    for (const company of missing) {
        const job = await fetchOneJobForCompany(company);
        if (job) {
            fallbackJobs.push(job);
            console.log(`   ✅ ${company}: ${job.role}`);
        } else {
            console.log(`   ❌ ${company}: No results from SerpApi`);
        }
        await new Promise(r => setTimeout(r, 600));
    }
    
    return fallbackJobs;
}

export default { fillMissingCompanies, ALL_COMPANIES };
