#!/usr/bin/env node
/**
 * Validation script: Ensures ALL companies return at least 1 job
 * Run: SERPAPI_KEY=your_key node scraper/validate-all-companies.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const companies = require('./companies.json');
const { scrapeGreenhouseJobs } = await import('./greenhouse.js');
const { scrapeWorkdayJobs } = await import('./workday.js');
const { scrapeLeverJobs } = await import('./lever.js');
const { fillMissingCompanies, ALL_COMPANIES } = await import('./serpapi-fallback.js');

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   VALIDATION: Ensure ALL companies return at least 1 job');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allJobs = [];
    
    // Greenhouse
    console.log('1. Greenhouse...');
    try {
        const gh = await scrapeGreenhouseJobs();
        allJobs.push(...gh);
        console.log(`   ${gh.length} jobs\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }
    
    // Workday (with timeout)
    console.log('2. Workday...');
    try {
        const wd = await Promise.race([
            scrapeWorkdayJobs(),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 45000))
        ]);
        if (Array.isArray(wd)) {
            allJobs.push(...wd);
            console.log(`   ${wd.length} jobs\n`);
        } else {
            console.log('   Timeout or error\n');
        }
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }
    
    // Lever
    console.log('3. Lever...');
    try {
        const lv = await scrapeLeverJobs();
        allJobs.push(...lv);
        console.log(`   ${lv.length} jobs\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }
    
    // SerpApi fallback for missing
    console.log('4. SerpApi fallback for companies with 0...');
    const fallback = await fillMissingCompanies(allJobs);
    allJobs.push(...fallback);
    
    // Count per company (each job maps to first matching company)
    const byCompany = {};
    for (const j of allJobs) {
        const jc = (j.company || '').toLowerCase();
        for (const c of ALL_COMPANIES) {
            const tc = c.toLowerCase();
            if (jc.includes(tc) || tc.includes(jc.split(/[,\s]/)[0])) {
                byCompany[c] = (byCompany[c] || 0) + 1;
                break;
            }
        }
    }
    
    // Report
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   RESULT: Jobs per company');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let allOk = true;
    for (const c of ALL_COMPANIES) {
        const count = byCompany[c] || 0;
        const status = count >= 1 ? '✅' : '❌';
        if (count < 1) allOk = false;
        console.log(`   ${status} ${c}: ${count} jobs`);
    }
    
    console.log(`\n   Total jobs: ${allJobs.length}`);
    console.log(`   ${allOk ? '✅ ALL companies have at least 1 job' : '❌ Some companies still have 0'}\n`);
    process.exit(allOk ? 0 : 1);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
