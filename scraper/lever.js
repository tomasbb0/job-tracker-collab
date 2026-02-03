/**
 * Lever Job Board API Scraper
 * Fetches jobs from companies using Lever ATS
 * API is free and public - no authentication needed
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const companies = require("./companies.json");

const LEVER_API_BASE = "https://api.lever.co/v0/postings";

async function fetchLeverJobs(companySlug) {
  const url = `${LEVER_API_BASE}/${companySlug}?mode=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Failed to fetch jobs from ${companySlug}: ${response.status}`,
      );
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${companySlug}:`, error.message);
    return [];
  }
}

function matchesLocation(job, targetLocations) {
  const jobLocation = (job.categories?.location || "").toLowerCase();
  const genericLocations = [
    "hybrid",
    "distributed",
    "remote",
    "emea",
    "europe",
  ];

  if (genericLocations.some((g) => jobLocation.includes(g))) return true;

  return targetLocations.some((loc) => jobLocation.includes(loc.toLowerCase()));
}

function quickPreFilter(job, criteria) {
  const title = job.text?.toLowerCase() || "";

  // Exclude tech roles
  if (
    criteria.excludeRoleKeywords?.some((kw) => title.includes(kw.toLowerCase()))
  ) {
    return false;
  }

  // Must match target roles
  if (criteria.targetRoleKeywords?.length > 0) {
    return criteria.targetRoleKeywords.some((kw) =>
      title.includes(kw.toLowerCase()),
    );
  }

  return true;
}

function transformJob(job, companyName) {
  return {
    id: `lever_${job.id}`,
    company: companyName,
    role: job.text,
    location: job.categories?.location || "Unknown",
    link: job.hostedUrl,
    description: job.descriptionPlain || "",
    departments: job.categories?.team ? [job.categories.team] : [],
    updatedAt: new Date(job.createdAt).toISOString(),
    source: "lever",
    rawData: {
      leverId: job.id,
      commitment: job.categories?.commitment,
      department: job.categories?.department,
    },
  };
}

export async function scrapeLeverJobs() {
  const allJobs = [];
  const leverCompanies = companies.lever || [];
  const criteria = companies.filterCriteria;

  console.log(`\n🔷 Scraping ${leverCompanies.length} Lever companies...`);

  for (const company of leverCompanies) {
    console.log(`\n📋 Fetching jobs from ${company.name}...`);

    const jobs = await fetchLeverJobs(company.slug);
    console.log(`   Found ${jobs.length} total jobs`);

    // Filter by location
    const locationMatched = jobs.filter((job) =>
      matchesLocation(job, company.locations),
    );
    console.log(`   ${locationMatched.length} jobs in target locations`);

    // Pre-filter
    const preFiltered = locationMatched.filter((job) =>
      quickPreFilter(job, criteria),
    );
    console.log(`   ${preFiltered.length} jobs after pre-filter`);

    // Transform
    const transformed = preFiltered.map((job) =>
      transformJob(job, company.name),
    );
    allJobs.push(...transformed);

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ Lever scraping complete: ${allJobs.length} candidate jobs`);
  return allJobs;
}

export default { scrapeLeverJobs, fetchLeverJobs };
