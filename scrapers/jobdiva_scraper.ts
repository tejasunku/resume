import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface JobFromAPI {
  id: number;
  title: string;
  refNo: string;
  location: string;
  payRate: string | null;
  payFrequency: string | null;
  jobDescription: string;
  postDate: number;
  url: string;
}

interface ScrapeResult {
  scrapeDate: string;
  portalUrl: string;
  source: string;
  totalJobs: number;
  jobs: JobFromAPI[];
}

const PORTAL_URL = process.argv[2] || 'https://www1.jobdiva.com/portal/?a=p0jdnwrmcdb9gj5vhwefxbkvdz3fht07baj9m2kksyrxox5fvzzwoe1s3f8728c8#/';
const SOURCE_NAME = process.argv[3] || 'Leadstack Portal';
const OUTPUT_NAME = process.argv[4] || 'leadstack';
const RAW_DIR = 'private/raw_webpages';

// Extract portal token from URL
const MATCH = PORTAL_URL.match(/[?&]a=([^&#]+)/);
const API_TOKEN = MATCH ? MATCH[1] : '';

function getOutputFilename(): string {
  const now = new Date();
  const datetime = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return join(RAW_DIR, `${OUTPUT_NAME}_jobs_${datetime}.json`);
}

async function scrapeAllJobs() {
  mkdirSync(RAW_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allJobs: JobFromAPI[] = [];
  let apiHeaders: Record<string, string> | null = null;

  // Capture headers from the first API call
  await page.route('**/searchjobsportal', async (route, request) => {
    apiHeaders = request.headers();
    console.log('Captured API headers');
    
    const response = await route.fetch();
    const body = await response.text();
    try {
      const data = JSON.parse(body);
      if (data && data.data && Array.isArray(data.data)) {
        for (const job of data.data) {
          allJobs.push({
            id: job.id,
            title: job.title || '',
            refNo: job.refNo || '',
            location: job.location || '',
            payRate: job.payRate,
            payFrequency: job.payFrequency,
            jobDescription: job.jobDescription || '',
            postDate: job.postDate,
            url: `${PORTAL_URL.replace('#/', '')}#/jobs/${job.id}`
          });
        }
        console.log(`Initial: ${data.data.length} jobs (total: ${data.total})`);
      }
    } catch (e) {
      console.log('Failed to parse initial response');
    }
    await route.fulfill({ response });
  });

  try {
    console.log('Loading portal to capture auth token...');
    await page.goto(PORTAL_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    if (!apiHeaders) {
      throw new Error('Failed to capture API headers');
    }

    const token = apiHeaders['token'];
    const portalId = apiHeaders['portalid'];
    console.log(`Token: ${token ? 'captured' : 'not found'}`);
    console.log(`PortalId: ${portalId || 'not found'}`);

    const totalText = await page.locator('text=/\\d+\\s+Jobs/').first().innerText().catch(() => '293 Jobs');
    const totalMatch = totalText.match(/(\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 293;
    console.log(`Total jobs: ${total}`);

    // Use REST API for pagination with captured auth
    let offset = allJobs.length;
    
    while (offset < total) {
      console.log(`Fetching ${offset + 1}-${Math.min(offset + 20, total)}...`);
      
      const moreUrl = `https://ws.jobdiva.com/candPortal/rest/job/getmore?from=${offset + 1}&to=0&count=20&portaltype=1`;
      
      const response = await context.request.get(moreUrl, {
        headers: {
          'Accept': '*/*',
          'a': API_TOKEN,
          'portalid': portalId || '1978',
          'token': token || ''
        }
      });
      
      const body = await response.text();
      
      try {
        const data = JSON.parse(body);
        const jobs = Array.isArray(data) ? data : (data.data || []);
        
        if (jobs.length === 0) {
          console.log('No more jobs');
          break;
        }
        
        for (const job of jobs) {
          allJobs.push({
            id: job.id,
            title: job.title || '',
            refNo: job.refNo || '',
            location: job.location || '',
            payRate: job.payRate,
            payFrequency: job.payFrequency,
            jobDescription: job.jobDescription || '',
            postDate: job.postDate,
            url: `${PORTAL_URL.replace('#/', '')}#/jobs/${job.id}`
          });
        }
        
        offset += jobs.length;
        console.log(`  +${jobs.length} jobs, total: ${allJobs.length}`);
      } catch (e) {
        console.log('  Parse error:', body.substring(0, 100));
        break;
      }
    }

    console.log(`\n=== Done ===`);
    console.log(`Total jobs: ${allJobs.length}`);

    const result: ScrapeResult = {
      scrapeDate: new Date().toISOString(),
      portalUrl: PORTAL_URL,
      source: SOURCE_NAME,
      totalJobs: allJobs.length,
      jobs: allJobs
    };

    const outputFile = getOutputFilename();
    writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`Saved to ${outputFile}`);

  } catch (error) {
    console.error('Error:', error);
    
    if (allJobs.length > 0) {
      const result: ScrapeResult = {
        scrapeDate: new Date().toISOString(),
        portalUrl: PORTAL_URL,
        source: SOURCE_NAME,
        totalJobs: allJobs.length,
        jobs: allJobs
      };
      const outputFile = getOutputFilename();
      writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`Saved partial (${allJobs.length} jobs) to ${outputFile}`);
    }
  } finally {
    await browser.close();
  }
}

scrapeAllJobs().catch(console.error);