import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Job {
  id: string;
  title: string;
  url: string;
  location: string;
  city: string;
  state: string;
  country: string;
  postedDate: string;
  description: string;
}

interface ScrapeResult {
  scrapeDate: string;
  source: string;
  sourceUrl: string;
  totalJobs: number;
  jobs: Job[];
}

const RAW_DIR = 'private/raw_webpages';
const SOURCE_URL = 'https://careers.cbre.com/en_US/careers/SearchJobs/?18018=%5B4758018%2C4758014%2C4758015%2C4758017%5D&18018_format=25600&9577=%5B17276%5D&9577_format=10224&listFilterMode=1&jobRecordsPerPage=25';
const SOURCE_NAME = 'CBRE Careers';

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const jobs: Job[] = [];
  let totalJobs = 0;
  
  // Capture API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/careers/SearchJobs') && response.request().method() === 'POST') {
      try {
        const data = await response.json();
        if (data?.jobs) {
          totalJobs = data.totalResults || data.jobs.length;
          for (const job of data.jobs) {
            jobs.push({
              id: job.jobId || job.id,
              title: job.jobName || job.title || '',
              url: `https://careers.cbre.com/careers/JobDetail/${job.jobKey || job.id}`,
              location: job.location || '',
              city: job.city || '',
              state: job.state || '',
              country: job.country || '',
              postedDate: job.postedDate || '',
              description: job.jobDescription || ''
            });
          }
        }
      } catch {}
    }
  });
  
  console.log(`Loading ${SOURCE_NAME}...`);
  await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for job listings to load
  await page.waitForSelector('.article--result', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  
  // Check if we got jobs from API
  if (jobs.length === 0) {
    // Try to parse HTML directly
    console.log('Parsing job listings from HTML...');
    const articles = await page.locator('.article--result').all();
    
    for (const article of articles) {
      const titleEl = article.locator('.article__header__text__title a, h3 a, a');
      const title = await titleEl.first().innerText().catch(() => '');
      const href = await titleEl.first().getAttribute('href').catch(() => '');
      
      const locationEl = article.locator('.article__header__text__subtitle, .job-location, .location');
      const location = await locationEl.first().innerText().catch(() => '');
      
      if (title && href) {
        const idMatch = href.match(/\/(\d+)$/);
        jobs.push({
          id: idMatch ? idMatch[1] : '',
          title: title.trim(),
          url: href.startsWith('http') ? href : `https://careers.cbre.com${href}`,
          location: location.trim(),
          city: '',
          state: '',
          country: '',
          postedDate: '',
          description: ''
        });
      }
    }
    
    // Get total count
    const totalText = await page.locator('.list-controls__text__legend').innerText().catch(() => '0');
    const totalMatch = totalText.match(/of\s+(\d+)/);
    totalJobs = totalMatch ? parseInt(totalMatch[1]) : jobs.length;
  }
  
  console.log(`Found ${jobs.length} jobs (total: ${totalJobs})`);
  
  // If there are more pages, we'd need pagination
  if (jobs.length > 0 && jobs.length < totalJobs) {
    console.log(`Pagination required: collected ${jobs.length} of ${totalJobs}. Trying pagination...`);
    
    let pageNum = 2;
    while (jobs.length < totalJobs && pageNum < 50) {
      // Look for pagination controls
      const nextBtn = page.locator('a[href*="page="], .pagination__next, .next, a.next').first();
      const hasNext = await nextBtn.count().catch(() => 0);
      
      if (!hasNext) break;
      
      await nextBtn.click().catch(() => null);
      await page.waitForTimeout(1500);
      await page.waitForSelector('.article--result', { timeout: 10000 }).catch(() => {});
      
      const newArticles = await page.locator('.article--result').all();
      for (const article of newArticles) {
        const titleEl = article.locator('.article__header__text__title a, h3 a, a');
        const title = await titleEl.first().innerText().catch(() => '');
        const href = await titleEl.first().getAttribute('href').catch(() => '');
        const locationEl = article.locator('.article__header__text__subtitle, .job-location, .location');
        const location = await locationEl.first().innerText().catch(() => '');
        
        if (title && href) {
          const idMatch = href.match(/\/(\d+)$/);
          jobs.push({
            id: idMatch ? idMatch[1] : '',
            title: title.trim(),
            url: href.startsWith('http') ? href : `https://careers.cbre.com${href}`,
            location: location.trim(),
            city: '',
            state: '',
            country: '',
            postedDate: '',
            description: ''
          });
        }
      }
      
      console.log(`Page ${pageNum}: ${jobs.length} total jobs`);
      pageNum++;
    }
  }
  
  const result: ScrapeResult = {
    scrapeDate: new Date().toISOString(),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    totalJobs: jobs.length,
    jobs
  };
  
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFile = join(RAW_DIR, `cbre_jobs_${datetime}.json`);
  
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\nSaved to ${outputFile}`);
  
  if (jobs.length > 0) {
    console.log(`\nSample job:`);
    console.log(`${jobs[0].title}`);
    console.log(`${jobs[0].location}`);
    console.log(`${jobs[0].url}`);
  }
  
  await browser.close();
}

main().catch(console.error);