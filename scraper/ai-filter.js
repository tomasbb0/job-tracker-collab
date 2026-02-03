/**
 * AI Filter Module
 * Uses Google Gemini (FREE) to analyze job descriptions and filter based on criteria
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import companies from './companies.json' assert { type: 'json' };

// Initialize Gemini with API key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FILTER_CRITERIA = companies.filterCriteria;

/**
 * System prompt for job analysis
 */
const SYSTEM_PROMPT = `You are a job listing analyzer. Your task is to analyze job postings and determine if they match specific criteria.

You must return ONLY a valid JSON object with NO additional text, markdown, or explanation.

Analyze each job and return:
{
  "is_tech_role": boolean,      // true if this is a technical/engineering role
  "years_required": number|null, // estimated years of experience required (null if not specified or entry-level)
  "is_internship": boolean,     // true if this is an internship or student position
  "languages_required": string[], // array of language codes required (e.g., ["en", "de", "fr"])
  "matches_criteria": boolean,   // true if job matches ALL criteria below
  "confidence": number,         // 0.0 to 1.0 confidence in analysis
  "reasoning": string           // brief explanation (max 100 chars)
}

CRITERIA FOR matches_criteria = true:
1. is_tech_role MUST be false (non-technical roles like sales, BD, marketing, ops, etc.)
2. years_required MUST be less than 3 OR null (entry-level friendly)
3. is_internship MUST be false
4. languages_required MUST ONLY contain "en", "es", "pt" (English, Spanish, Portuguese) or be empty

TECH ROLES (is_tech_role = true):
- Software Engineer, Developer, SWE, SDE
- Data Scientist, ML Engineer, AI Researcher
- DevOps, SRE, Platform Engineer
- Security Engineer, Penetration Tester
- Solutions Architect (technical), Technical Program Manager
- Research Scientist, PhD positions
- Any role requiring coding/programming as primary skill

NON-TECH ROLES (is_tech_role = false):
- Sales, BDR, SDR, Account Executive, Account Manager
- Business Development, Partnerships
- Customer Success, Customer Support
- Marketing, Communications, PR
- Operations, Strategy, Finance
- HR, Recruiting, People Operations
- Legal, Compliance
- Product Manager (business-focused), Program Manager (non-technical)

LANGUAGE DETECTION:
- Look for "fluency in German/French/Italian/Dutch/etc required"
- "Native speaker of X" where X is not English/Spanish/Portuguese
- If only English is mentioned or no language requirement, languages_required = ["en"]
- Spanish = "es", Portuguese = "pt"`;

/**
 * Analyze a single job with Gemini
 * @param {Object} job - Job object with role, description, etc.
 * @returns {Promise<Object>} - Analysis result
 */
async function analyzeJob(job) {
    const userPrompt = `${SYSTEM_PROMPT}

Analyze this job posting:

COMPANY: ${job.company}
ROLE: ${job.role}
LOCATION: ${job.location}

DESCRIPTION:
${job.description?.substring(0, 3000) || 'No description available'}

Return ONLY the JSON analysis object, nothing else.`;

    try {
        // Use Gemini 1.5 Flash (fast and free)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const content = response.text();
        
        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);
            return {
                ...analysis,
                analyzed: true
            };
        }
        
        throw new Error('No valid JSON in response');
    } catch (error) {
        console.error(`Error analyzing job "${job.role}":`, error.message);
        
        // Return a safe default that will be filtered out
        return {
            is_tech_role: true,
            years_required: null,
            is_internship: false,
            languages_required: [],
            matches_criteria: false,
            confidence: 0,
            reasoning: `Analysis failed: ${error.message}`,
            analyzed: false
        };
    }
}

/**
 * Batch analyze jobs with rate limiting
 * @param {Array} jobs - Array of job objects
 * @param {number} batchSize - Number of jobs to analyze in parallel
 * @param {number} delayMs - Delay between batches in milliseconds
 * @returns {Promise<Array>} - Jobs with analysis results
 */
async function batchAnalyzeJobs(jobs, batchSize = 5, delayMs = 1000) {
    const results = [];
    
    console.log(`\n🤖 Analyzing ${jobs.length} jobs with Gemini AI (FREE)...`);
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobs.length / batchSize)}...`);
        
        const batchResults = await Promise.all(
            batch.map(async (job) => {
                const analysis = await analyzeJob(job);
                return {
                    ...job,
                    aiAnalysis: analysis
                };
            })
        );
        
        results.push(...batchResults);
        
        // Rate limiting delay between batches (Gemini free tier: 60 req/min)
        if (i + batchSize < jobs.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
}

/**
 * Filter jobs based on AI analysis
 * @param {Array} analyzedJobs - Jobs with aiAnalysis property
 * @returns {Array} - Filtered jobs that match criteria
 */
function filterAnalyzedJobs(analyzedJobs) {
    return analyzedJobs.filter(job => {
        const analysis = job.aiAnalysis;
        
        if (!analysis || !analysis.analyzed) {
            return false;
        }
        
        return analysis.matches_criteria === true;
    });
}

/**
 * Main function: Analyze and filter jobs
 * @param {Array} jobs - Raw jobs from scrapers
 * @returns {Promise<Array>} - Filtered jobs matching all criteria
 */
export async function filterJobsWithAI(jobs) {
    console.log(`\n🔍 Starting AI filtering for ${jobs.length} jobs...`);
    
    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY environment variable is not set!');
        console.log('   Get your FREE API key at: https://aistudio.google.com/app/apikey');
        return [];
    }
    
    // Analyze all jobs
    const analyzedJobs = await batchAnalyzeJobs(jobs);
    
    // Filter based on criteria
    const matchingJobs = filterAnalyzedJobs(analyzedJobs);
    
    console.log(`\n✅ AI filtering complete:`);
    console.log(`   Total analyzed: ${analyzedJobs.length}`);
    console.log(`   Matching criteria: ${matchingJobs.length}`);
    console.log(`   Filtered out: ${analyzedJobs.length - matchingJobs.length}`);
    
    // Log some stats
    const techRoles = analyzedJobs.filter(j => j.aiAnalysis?.is_tech_role).length;
    const internships = analyzedJobs.filter(j => j.aiAnalysis?.is_internship).length;
    const highExp = analyzedJobs.filter(j => j.aiAnalysis?.years_required >= 3).length;
    
    console.log(`\n   Breakdown of filtered:`);
    console.log(`   - Tech roles: ${techRoles}`);
    console.log(`   - Internships: ${internships}`);
    console.log(`   - High experience (3+ yrs): ${highExp}`);
    
    return matchingJobs;
}

/**
 * Get analysis summary for a job (for UI display)
 * @param {Object} job - Job with aiAnalysis
 * @returns {Object} - Simplified summary
 */
export function getAnalysisSummary(job) {
    const analysis = job.aiAnalysis;
    
    if (!analysis) {
        return { status: 'Not analyzed', details: '' };
    }
    
    const badges = [];
    
    if (analysis.is_tech_role) badges.push('❌ Tech role');
    else badges.push('✅ Non-tech');
    
    if (analysis.years_required !== null) {
        if (analysis.years_required < 3) badges.push(`✅ ${analysis.years_required} yrs`);
        else badges.push(`❌ ${analysis.years_required}+ yrs`);
    } else {
        badges.push('✅ Entry-level');
    }
    
    if (analysis.is_internship) badges.push('❌ Internship');
    
    const langs = analysis.languages_required || [];
    const allowedLangs = ['en', 'es', 'pt', 'english', 'spanish', 'portuguese'];
    const hasOtherLang = langs.some(l => !allowedLangs.includes(l.toLowerCase()));
    if (hasOtherLang) badges.push(`❌ Requires: ${langs.join(', ')}`);
    
    return {
        status: analysis.matches_criteria ? '✅ MATCH' : '❌ NO MATCH',
        confidence: `${Math.round(analysis.confidence * 100)}%`,
        reasoning: analysis.reasoning,
        badges
    };
}

// Run directly if called as main module
if (import.meta.url === `file://${process.argv[1]}`) {
    // Test with sample jobs
    const testJobs = [
        {
            company: 'Test Corp',
            role: 'Business Development Representative',
            location: 'Dublin',
            description: 'We are looking for a BDR to join our sales team. 1-2 years of experience preferred. Must be fluent in English.'
        },
        {
            company: 'Test Corp',
            role: 'Senior Software Engineer',
            location: 'Dublin',
            description: 'Looking for a senior SWE with 5+ years of experience in Python and distributed systems.'
        }
    ];
    
    console.log('Testing AI filter with sample jobs...');
    const results = await filterJobsWithAI(testJobs);
    console.log('\nMatching jobs:', results.length);
    results.forEach(job => {
        console.log(`- ${job.role}: ${job.aiAnalysis.reasoning}`);
    });
}

export default { filterJobsWithAI, analyzeJob, getAnalysisSummary };
