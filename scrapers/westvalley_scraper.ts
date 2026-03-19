import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import https from 'https';

interface Job {
  id: string;
  url: string;
  rawText: string;
}

interface ScrapeResult {
  scrapeDate: string;
  source: string;
  sourceUrl: string;
  totalJobs: number;
  jobs: Job[];
}

const RAW_DIR = 'private/raw_webpages';
const SOURCE_URL = 'https://vcgworldlink.westvalley.com/portal/main.aspx?action=SearchOpportunities&mode=final';
const SOURCE_NAME = 'West Valley Staffing Group';

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) {
          fetchHtml(loc.startsWith('http') ? loc : `https://vcgworldlink.westvalley.com${loc}`).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/a>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+/gm, '')
    .trim();
}

function parseJobs(html: string): Job[] {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  
  const blocks = html.split('job-listing-row');
  
  for (const block of blocks) {
    const idMatch = block.match(/id=(\d+)/);
    if (!idMatch) continue;
    
    const id = idMatch[1];
    if (seen.has(id)) continue;
    seen.add(id);
    
    const text = htmlToText(block);
    
    jobs.push({
      id,
      url: `https://vcgworldlink.westvalley.com/portal/main.aspx?action=SearchOpportunitiesDetail&mode=initial&id=${id}`,
      rawText: text
    });
  }
  
  return jobs;
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  
  console.log(`Fetching ${SOURCE_NAME}...`);
  const html = await fetchHtml(SOURCE_URL);
  
  console.log('Parsing jobs...');
  const jobs = parseJobs(html);
  
  console.log(`Found ${jobs.length} jobs`);
  
  const result: ScrapeResult = {
    scrapeDate: new Date().toISOString(),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    totalJobs: jobs.length,
    jobs
  };
  
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFile = join(RAW_DIR, `westvalley_jobs_${datetime}.json`);
  
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`Saved to ${outputFile}`);
  
  console.log(`\nSample job:`);
  if (jobs.length > 0) {
    console.log(`\n--- ${jobs[0].id} ---`);
    console.log(jobs[0].rawText.substring(0, 500));
  }
}

main().catch(console.error);