#!/usr/bin/env node
/**
 * Filter Greenhouse job lists for:
 * - Non-tech, entry-level (1-3 yrs), non-internship
 * - No mandatory language other than Portuguese, English, or Spanish
 * Company-specific exclusions applied (see comments below).
 */

const fs = require('fs');
const path = require('path');

const BOARDS = [
  { file: 'hubspot.json', company: 'HubSpot', slug: 'hubspotjobs' },
  { file: 'datadog.json', company: 'Datadog', slug: 'datadog' },
  { file: 'databricks.json', company: 'Databricks', slug: 'databricks' },
  { file: 'anthropic.json', company: 'Anthropic', slug: 'anthropic' },
];

const TECH_KEYWORDS = [
  'engineer', 'developer', 'software', 'research scientist', 'data scientist',
  'ml engineer', 'devops', 'sre', 'infrastructure', 'security engineer',
  'technical architect', 'data engineer', 'solutions architect', 'platform engineer',
  'site reliability', 'qa engineer', 'product designer', 'ux engineer', 'ux designer',
  'machine learning', 'ai research', ' applied scientist', 'software architect',
  'technical program manager', 'technical account management', 'technical recruiter',
  'security analyst', 'web development', 'services architect', 'field ciso', 'field cto',
  'data architect', 'data science architect', 'consulting data architect', 'technical solutions',
  'threat investigator', 'systems architect',
];

const INTERN_KEYWORDS = ['intern', 'internship', 'co-op'];

const SENIOR_KEYWORDS = ['senior', 'staff', 'principal', 'lead engineer', 'director', 'vp', 'vice president', 'head of', ' lead', 'lead ', 'manager', 'sr. manager', ' leader', 'team lead'];

const OK_LANGUAGES = new Set(['none', 'english', 'spanish', 'portuguese', '']);

function getMeta(job, name) {
  const m = (job.metadata || []).find((x) => x.name === name);
  if (!m) return null;
  const v = m.value;
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
  return v != null ? String(v).toLowerCase() : null;
}

function hasTechTitle(title) {
  const t = title.toLowerCase();
  return TECH_KEYWORDS.some((k) => t.includes(k));
}

function isIntern(title) {
  const t = title.toLowerCase();
  return INTERN_KEYWORDS.some((k) => t.includes(k));
}

function isSeniorTitle(title) {
  const t = title.toLowerCase();
  return SENIOR_KEYWORDS.some((k) => t.includes(k));
}

function languageOk(job) {
  const lang = getMeta(job, 'Language');
  if (lang == null || lang === '') return true;
  const v = (Array.isArray(lang) ? lang[0] : lang).trim();
  if (!v) return true;
  return OK_LANGUAGES.has(v);
}

function isNonTechRole(job) {
  const title = (job.title || '').toLowerCase();
  if (hasTechTitle(job.title)) return false;
  const area = getMeta(job, 'Area - Engineering');
  const cost = getMeta(job, 'Cost Center');
  if (area && (area.includes('engineering') || area.includes('data science'))) return false;
  if (cost && (cost.includes('engineering') || cost.includes('dev eng'))) return false;
  const cat = getMeta(job, 'Career Site Mapping Field') || getMeta(job, 'Career Page Posting Category');
  const salesLike = ['sales', 'account', 'bdr', 'sdr', 'business development', 'customer success', 'marketing', 'individual contributor'];
  const catStr = Array.isArray(cat) ? cat.join(' ') : (cat || '');
  if (catStr && !salesLike.some((s) => catStr.includes(s))) {
    if (catStr.includes('engineering') || catStr.includes('design') && !catStr.includes('sales')) return false;
  }
  return true;
}

const LANGUAGE_MARKET_EXCLUDE = /\((italy|dach|german|french|japan|china|hong kong|taiwan|indonesia|malaysia|israel)\)|-\s*(france|german|dutch|paris)\s|dutch|mandarin|japanese|korean|\(gcr\)|gcr market|paris|vietnam market/i;

function languageMarketOk(title) {
  return !LANGUAGE_MARKET_EXCLUDE.test(title || '');
}

function applyCompanyRules(job, company) {
  const title = (job.title || '').toLowerCase();
  const loc = (job.location?.name || '').toLowerCase();

  if (!languageMarketOk(job.title)) return false;

  if (company === 'HubSpot') {
    if (title.includes('bdr') || title.includes('business development representative')) return false;
    if (!languageOk(job)) return false;
    return true;
  }

  if (company === 'Datadog') {
    if (title.includes('sdr') || title.includes('sales development representative')) return false;
    if (/(italy|dach|german|france|french|dutch)\b/.test(title)) return false;
    return true;
  }

  if (company === 'Databricks') {
    const isBDR = title.includes('bdr') || title.includes('business development representative');
    const usOrIndia = loc.includes('usa') || loc.includes('united states') || loc.includes('india');
    if (isBDR && usOrIndia) return true;
    if (isBDR && !usOrIndia) return false;
    if (!isBDR && (title.includes('account executive') || title.includes('sales'))) return false;
    return true;
  }

  if (company === 'Anthropic') {
    if (/german|french|italian|dutch|mandarin|japanese|korean|chinese/.test(title)) return false;
    return true;
  }

  return true;
}

function run() {
  const rows = [];
  const base = path.resolve(__dirname);

  for (const { file, company } of BOARDS) {
    const filepath = path.join(base, file);
    if (!fs.existsSync(filepath)) continue;
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const jobs = data.jobs || [];

    for (const job of jobs) {
      if (isIntern(job.title)) continue;
      if (hasTechTitle(job.title)) continue;
      if (isSeniorTitle(job.title)) continue;
      if (!isNonTechRole(job)) continue;
      if (!applyCompanyRules(job, company)) continue;
      if (company === 'HubSpot' && !languageOk(job)) continue;

      const url = job.absolute_url || '';
      if (!url || url.includes('/search') || url.includes('careers.google.com')) continue;

      rows.push({
        company,
        role: job.title,
        location: job.location?.name || '—',
        url,
      });
    }
  }

  // Dedupe by company|role
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.company}|${r.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

const results = run();

console.log('## Non-tech, entry-level (1–3 yrs), non-internship jobs');
console.log('(No mandatory language other than Portuguese, English, or Spanish.)');
console.log('');
console.log('| Company | Role | Location | Apply |');
console.log('|---------|------|----------|-------|');

for (const r of results) {
  const role = (r.role || '').replace(/\|/g, ' ');
  const loc = (r.location || '—').replace(/\|/g, ' ');
  console.log(`| ${r.company} | ${role} | ${loc} | [Apply](${r.url}) |`);
}

console.log('');
console.log(`**Total: ${results.length} positions.**`);
console.log('');
console.log('*Verify years of experience and language requirements on each apply page.*');
console.log('');
console.log('---');
console.log('**Sources:** Greenhouse API (HubSpot, Datadog, Databricks, Anthropic).');
console.log('**Not scraped** (per your notes or inaccessible): Uber, Stripe, Snowflake, OpenAI, Palantir, Adyen, Meta, Microsoft, Salesforce, Amazon AWS, Cloudflare, Figma, Atlassian, Intercom.');
