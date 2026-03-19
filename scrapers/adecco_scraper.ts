import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import https from 'https';

interface AdeccoJob {
  jobId: string;
  jobTitle: string;
  cisJobId: string;
  jobLocation: string;
  minsalary: number | null;
  maxsalary: number | null;
  salaryCurrency: string;
  salaryTimeScale: string;
  jobType: string;
  jobCategoryId: string;
  jobCategoryTitle: string;
  jobSubCategoryTitle: string;
  jobCreationDate: string;
  postedDate: string;
  isRemote: boolean;
  cityName: string;
  stateName: string;
  description: string | null;
}

interface AdeccoResponse {
  jobs: AdeccoJob[];
  pagination: {
    total: number;
    nextRange: number;
  };
}

interface ScrapedJob {
  id: string;
  title: string;
  location: string;
  city: string;
  state: string;
  jobType: string;
  category: string;
  subcategory: string;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string;
  payTimeScale: string;
  isRemote: boolean;
  postedDate: string;
  url: string;
}

interface ScrapeResult {
  scrapeDate: string;
  source: string;
  sourceUrl: string;
  totalJobs: number;
  jobs: ScrapedJob[];
}

const RAW_DIR = 'private/raw_webpages';
const API_URL = 'https://www.adecco.com/api/data/jobs/summarized';
const SOURCE_URL = 'https://www.adecco.com/en-us/job-search?CategoryFilter=ADUS-2700,ADUS-2400';
const SOURCE_NAME = 'Adecco US';

// Filter: ADUS-2700 (IT), ADUS-2400 (Engineering) - returns ~79 jobs
const API_BODY = {
  queryString: '&sort=PostedDate desc&facet.pivot=IsRemote&fq=JobCategoryId:((ADUS-2700*) OR (ADUS-2400*))&facet.range=Salary_Facet_Yearly&f.Salary_Facet_Yearly.facet.range.start=0&f.Salary_Facet_Yearly.facet.range.end=10000000&f.Salary_Facet_Yearly.facet.range.gap=500&facet.range=Salary_Facet_Hourly&f.Salary_Facet_Hourly.facet.range.start=0&f.Salary_Facet_Hourly.facet.range.end=850&f.Salary_Facet_Hourly.facet.range.gap=5',
  filtersToDisplay: '{560BF70E-758B-4C64-AB0D-639D213A40CA}|{7E7CF621-B71B-4275-8486-B63291DBF9C6}|{8B43F831-F001-4316-BB51-54363B101FBB}|{E87A7C83-C871-4D77-85D8-0A8E01C08428}|{131E799A-5E3E-483A-A9E4-F84CABA02642}|{3589D484-9187-460D-B26B-8B465105B52C}|{2ECB0E8F-13CF-41FA-87E4-4961C0E98090}|{3D8CE09B-2747-4797-9DA2-0EEC2A8C3B18}',
  siteName: 'adecco',
  brand: 'adecco',
  countryCode: 'US',
  languageCode: 'en-US'
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJobs(range: number): Promise<AdeccoResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...API_BODY, range });
    
    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse failed at range ${range}. Response: ${data.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchWithRetry(range: number, retries = 5): Promise<AdeccoResponse> {
  for (let i = 0; i < retries; i++) {
    try {
      await sleep(1500); // 1.5 second delay before each request
      return await fetchJobs(range);
    } catch (e) {
      if (i === retries - 1) throw e;
      const wait = (i + 1) * 5000; // 5s, 10s, 15s, 20s exponential backoff
      console.log(`Retry ${i + 1}/${retries} for range ${range}, waiting ${wait/1000}s...`);
      await sleep(wait);
    }
  }
  throw new Error('Should not reach here');
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  
  console.log(`Fetching ${SOURCE_NAME} (IT & Engineering only)...`);
  
  const firstPage = await fetchWithRetry(0);
  const allJobs: AdeccoJob[] = [...firstPage.jobs];
  const total = firstPage.pagination?.total || 0;
  
  console.log(`Found ${total} total matching jobs, fetching all...`);
  
  let range = firstPage.pagination?.nextRange || 10;
  while (range < total) {
    const page = await fetchWithRetry(range);
    allJobs.push(...page.jobs);
    console.log(`Fetched ${allJobs.length}/${total} jobs`);
    range = page.pagination?.nextRange || range + 10;
    if (page.jobs.length === 0) break;
  }
  
  const jobs: ScrapedJob[] = allJobs.map(job => ({
    id: job.jobId,
    title: job.jobTitle,
    location: job.jobLocation,
    city: job.cityName,
    state: job.stateName,
    jobType: job.jobType,
    category: job.jobCategoryTitle,
    subcategory: job.jobSubCategoryTitle,
    payMin: job.minsalary,
    payMax: job.maxsalary,
    payCurrency: job.salaryCurrency,
    payTimeScale: job.salaryTimeScale,
    isRemote: job.isRemote,
    postedDate: job.postedDate,
    url: `https://www.adecco.com/en-us/job-search?k=${encodeURIComponent(job.jobTitle)}&l=`
  }));
  
  const result: ScrapeResult = {
    scrapeDate: new Date().toISOString(),
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    totalJobs: jobs.length,
    jobs
  };
  
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputFile = join(RAW_DIR, `adecco_jobs_${datetime}.json`);
  
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\nSaved ${jobs.length} jobs to ${outputFile}`);
  
  console.log(`\nSample jobs:`);
  jobs.slice(0, 3).forEach((j, i) => {
    console.log(`\n${i + 1}. ${j.title}`);
    console.log(`   Location: ${j.location}`);
    console.log(`   Pay: $${j.payMin}${j.payMax && j.payMax !== j.payMin ? ` - $${j.payMax}` : ''} / ${j.payTimeScale}`);
    console.log(`   Type: ${j.jobType}`);
  });
}

main().catch(console.error);