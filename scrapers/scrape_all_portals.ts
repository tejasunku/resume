import { chromium } from 'playwright';
import type { BrowserContext } from 'playwright';
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
  portalId: string;
  source: string;
  totalJobs: number;
  jobs: JobFromAPI[];
}

interface Portal {
  url: string;
  name: string;
  outputName: string;
}

const PORTALS: Portal[] = [
  {
    url: 'https://www1.jobdiva.com/portal/?a=p0jdnwrmcdb9gj5vhwefxbkvdz3fht07baj9m2kksyrxox5fvzzwoe1s3f8728c8#/',
    name: 'Leadstack Portal',
    outputName: 'leadstack'
  },
  {
    url: 'https://www2.jobdiva.com/portal/?a=nyjdnw8rs3eurnjvdink7d2fl4mnyy0b22tjlzi328snknlo1pzpk0ue533mvm7r&compid=2#/',
    name: 'Russell Tobin',
    outputName: 'russelltobin'
  }
];

const RAW_DIR = 'private/raw_webpages';

function getOutputFilename(outputName: string): string {
  const now = new Date();
  const datetime = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return join(RAW_DIR, `${outputName}_jobs_${datetime}.json`);
}

function extractToken(url: string): string {
  const match = url.match(/[?&]a=([^&#]+)/);
  return match ? match[1] : '';
}

async function scrapePortal(portal: Portal): Promise<ScrapeResult> {
  const apiToken = extractToken(portal.url);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allJobs: JobFromAPI[] = [];
  let apiHeaders: Record<string, string> | null = null;

  // Capture headers from first API call
  await page.route('**/searchjobsportal', async (route, request) => {
    apiHeaders = request.headers();
    const response = await route.fetch();
    const body = await response.text();
    try {
      const data = JSON.parse(body);
      if (data?.data && Array.isArray(data.data)) {
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
            url: `${portal.url.replace('#/', '')}#/jobs/${job.id}`
          });
        }
        console.log(`[${portal.outputName}] Initial: ${data.data.length} jobs (total: ${data.total})`);
      }
    } catch (e) {
      console.log(`[${portal.outputName}] Failed to parse initial response`);
    }
    await route.fulfill({ response });
  });

  try {
    console.log(`[${portal.outputName}] Loading portal...`);
    await page.goto(portal.url, { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    if (!apiHeaders) {
      throw new Error('Failed to capture API headers');
    }

    const token = apiHeaders['token'];
    const portalId = apiHeaders['portalid'];
    console.log(`[${portal.outputName}] PortalId: ${portalId}`);

    const totalText = await page.locator('text=/\\d+\\s+Jobs/').first().innerText().catch(() => '0 Jobs');
    const totalMatch = totalText.match(/(\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    let offset = allJobs.length;
    while (offset < total) {
      const moreUrl = `https://ws.jobdiva.com/candPortal/rest/job/getmore?from=${offset + 1}&to=0&count=20&portaltype=1`;
      
      const response = await context.request.get(moreUrl, {
        headers: {
          'Accept': '*/*',
          'a': apiToken,
          'portalid': portalId || '',
          'token': token || ''
        }
      });
      
      const body = await response.text();
      try {
        const data = JSON.parse(body);
        const jobs = Array.isArray(data) ? data : (data.data || []);
        if (jobs.length === 0) break;
        
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
            url: `${portal.url.replace('#/', '')}#/jobs/${job.id}`
          });
        }
        offset += jobs.length;
        console.log(`[${portal.outputName}] ${allJobs.length}/${total} jobs`);
      } catch (e) {
        break;
      }
    }

    console.log(`[${portal.outputName}] Complete: ${allJobs.length} jobs`);

    return {
      scrapeDate: new Date().toISOString(),
      portalUrl: portal.url,
      portalId: portalId || '',
      source: portal.name,
      totalJobs: allJobs.length,
      jobs: allJobs
    };

  } catch (error) {
    console.error(`[${portal.outputName}] Error:`, error);
    return {
      scrapeDate: new Date().toISOString(),
      portalUrl: portal.url,
      portalId: '',
      source: portal.name,
      totalJobs: allJobs.length,
      jobs: allJobs
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });

  console.log(`Scraping ${PORTALS.length} portals in parallel...\n`);

  // Run all portals in parallel
  const results = await Promise.all(
    PORTALS.map(portal => scrapePortal(portal))
  );

  // Save results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const outputFile = getOutputFilename(PORTALS[i].outputName);
    writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nSaved ${PORTALS[i].outputName} to ${outputFile}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  for (let i = 0; i < results.length; i++) {
    console.log(`${PORTALS[i].name}: ${results[i].totalJobs} jobs`);
  }
}

main().catch(console.error);