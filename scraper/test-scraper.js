#!/usr/bin/env node

/**
 * Test script to run the Greenhouse scraper and save results
 */

import { scrapeGreenhouseJobs } from "./greenhouse.js";
import fs from "fs";

async function test() {
  console.log("Scraping all Greenhouse jobs...\n");
  const jobs = await scrapeGreenhouseJobs();

  // Save to JSON file
  fs.writeFileSync("scraped_jobs.json", JSON.stringify(jobs, null, 2));
  console.log("\n✅ Saved", jobs.length, "jobs to scraped_jobs.json");

  // Summary by company
  console.log("\n=== SUMMARY BY COMPANY ===");
  const byCompany = {};
  jobs.forEach((j) => {
    byCompany[j.company] = (byCompany[j.company] || 0) + 1;
  });

  Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .forEach(([company, count]) => {
      console.log(`  ${company}: ${count} jobs`);
    });

  // Find entry-level jobs
  console.log("\n=== ENTRY-LEVEL / JUNIOR ROLES ===");
  const entryLevel = jobs.filter((j) =>
    j.role
      .toLowerCase()
      .match(
        /bdr|sdr|junior|entry|associate|representative|early career|growth specialist|business development rep/,
      ),
  );
  console.log(`Found ${entryLevel.length} likely entry-level roles:\n`);

  entryLevel.forEach((j) => {
    console.log(`  📌 ${j.company}: ${j.role}`);
    console.log(`     📍 ${j.location}`);
    console.log(`     🔗 ${j.url}\n`);
  });
}

test().catch(console.error);
