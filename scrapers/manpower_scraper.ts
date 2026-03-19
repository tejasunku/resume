import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Job {
  id: string;
  url: string;
  title: string;
  location: string;
  employmentType: string;
  domain: string;
  salary: { rate: string | null; unit: string | null };
  description: string;
  postedDate: string;
  company: string;
}

interface ScrapeResult {
  scrapeDate: string;
  source: string;
  sourceUrl: string;
  industry: string;
  totalJobs: number;
  jobs: Job[];
}

const RAW_DIR = 'private/raw_webpages';
const API_URL = 'https://www.manpower.com/api/services/Jobs/searchjobs';

const INDUSTRIES = [
  { name: 'Computer', key: '5345aaf37c424a89945e75f9af3e2ad1' }
];

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJobs(industry: { name: string; key: string }, offset: number = 0, limit: number = 50): Promise<{ jobs: any[]; total: number }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sf: 'industries',
      filter: {
        page: '1',
        industries: [{ value: industry.name, key: industry.key }],
        offset,
        totalCount: 0,
        limit,
        searchkeyword: null,
        haslocation: false,
        language: 'en'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    jobs: data.jobsItems || [],
    total: data.jobsItems?.length || 0
  };
}

async function scrapeIndustry(industry: { name: string; key: string }): Promise<Job[]> {
  console.log(`Scraping ${industry.name} industry...`);
  
  const allJobs: Job[] = [];
  const limit = 50;
  let offset = 0;
  
  // Manpower returns all jobs in one request (no pagination needed typically)
  const result = await fetchJobs(industry, offset, limit);
  
  for (const job of result.jobs) {
    allJobs.push({
      id: job.jobID,
      url: `https://www.manpower.com${job.jobURL}`,
      title: job.jobTitle || '',
      location: job.jobLocation || '',
      employmentType: job.employmentType || '',
      domain: job.domain || '',
      salary: {
        rate: job.salaryRate,
        unit: job.salaryUnit
      },
      description: htmlToText(job.publicDescription || ''),
      postedDate: job.publishfromDate || '',
      company: job.companyName || 'Manpower'
    });
  }
  
  console.log(`  Found ${allJobs.length} jobs in ${industry.name}`);
  return allJobs;
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });

  const allJobs: Job[] = [];

  for (const industry of INDUSTRIES) {
    try {
      const jobs = await scrapeIndustry(industry);
      allJobs.push(...jobs);
      console.log(`  Total: ${allJobs.length} jobs`);
    } catch (error) {
      console.error(`Error scraping ${industry.name}:`, error);
    }
  }

  const result: ScrapeResult = {
    scrapeDate: new Date().toISOString(),
    source: 'Manpower US',
    sourceUrl: 'https://www.manpower.com/en/search',
    industry: INDUSTRIES.map(i => i.name).join(', '),
    totalJobs: allJobs.length,
    jobs: allJobs
  };

  const datetime = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFile = join(RAW_DIR, `manpower_jobs_${datetime}.json`);
  
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\nSaved to ${outputFile}`);
  
  console.log(`\nSample jobs:`);
  allJobs.slice(0, 2).forEach((job, i) => {
    console.log(`\n--- Job ${i + 1}: ${job.title} ---`);
    console.log(`Location: ${job.location}`);
    console.log(`Type: ${job.employmentType}`);
    console.log(`Pay: ${job.salary.rate || 'N/A'} ${job.salary.unit || ''}`);
    console.log(`Description preview: ${job.description.substring(0, 200)}...`);
  });
}

main().catch(console.error);