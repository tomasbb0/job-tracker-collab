/**
 * JobSpy Integration - OPEN SOURCE, NO API LIMITS!
 * 
 * Uses Python's JobSpy library to scrape:
 * - LinkedIn
 * - Indeed  
 * - Glassdoor
 * - Google Jobs
 * - ZipRecruiter
 * 
 * Install: pip install python-jobspy
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run JobSpy Python scraper and return results
 */
export async function scrapeWithJobSpy() {
    console.log('\n🔍 JobSpy Open Source Scraper (NO API LIMITS!)');
    console.log('   Scraping: LinkedIn, Indeed, Glassdoor\n');
    
    const pythonScript = `
import warnings
warnings.filterwarnings('ignore')
from jobspy import scrape_jobs
import pandas as pd
import json

all_jobs = []
searches = [
    ("sales development representative", "Dublin, Ireland", "Ireland"),
    ("business development representative", "Dublin, Ireland", "Ireland"),
    ("SDR", "Dublin, Ireland", "Ireland"),
    ("sales development representative", "London, UK", "UK"),
    ("business development representative", "London, UK", "UK"),
]

for search_term, location, country in searches:
    try:
        jobs = scrape_jobs(
            site_name=["linkedin", "indeed"],
            search_term=search_term,
            location=location,
            results_wanted=40,
            hours_old=168,
            country_indeed=country
        )
        all_jobs.append(jobs)
    except: pass

combined = pd.concat(all_jobs, ignore_index=True) if all_jobs else pd.DataFrame()
combined = combined.drop_duplicates(subset=['job_url'])

# Filter entry-level
exclude = ['senior', 'sr.', 'manager', 'director', 'head of', 'principal', 'lead', 'vp', 'vice president', 'chief']
def is_entry_level(title):
    title_lower = str(title).lower()
    return not any(ex in title_lower for ex in exclude)

entry_level = combined[combined['title'].apply(is_entry_level)]

# Convert to JSON
results = []
for _, job in entry_level.iterrows():
    results.append({
        'company': str(job.get('company', 'Unknown')),
        'role': str(job.get('title', 'N/A')),
        'location': str(job.get('location', 'N/A')),
        'link': str(job.get('job_url', '')),
        'site': str(job.get('site', '')),
        'description': str(job.get('description', ''))[:300] if pd.notna(job.get('description')) else ''
    })

print(json.dumps(results))
`;

    try {
        const result = execSync(`python3 -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
            timeout: 300000 // 5 min timeout
        });
        
        // Find the JSON array in output
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const jobs = JSON.parse(jsonMatch[0]);
            console.log(`✅ Found ${jobs.length} entry-level jobs!`);
            return jobs;
        }
        
        return [];
    } catch (error) {
        console.error('JobSpy error:', error.message);
        
        // Try reading from CSV if it exists
        const csvPath = path.join(__dirname, 'JOBSPY_RESULTS.csv');
        if (existsSync(csvPath)) {
            console.log('   Reading from cached results...');
            const csv = readFileSync(csvPath, 'utf-8');
            const lines = csv.trim().split('\\n').slice(1);
            return lines.map(line => {
                const [company, title, location, job_url, site] = line.split(',');
                return { company, role: title, location, link: job_url, site };
            });
        }
        
        return [];
    }
}

// Test
if (import.meta.url === \`file://\${process.argv[1]}\`) {
    const jobs = await scrapeWithJobSpy();
    console.log('\\nSample jobs:');
    jobs.slice(0, 10).forEach(j => {
        console.log(\`- \${j.company}: \${j.role} (\${j.location})\`);
    });
}

export default { scrapeWithJobSpy };
