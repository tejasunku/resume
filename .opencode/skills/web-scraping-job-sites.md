---
description: Best practices for scraping job search websites and SPAs
---

## Q: How do I determine if a job site needs Playwright vs webfetch?

**A**: Check if the site is a Single Page Application (SPA):
- Look for `<noscript>` tags saying "You need to enable JavaScript"
- Check for JavaScript bundles like `index_bundle.js`, `app.js`, `main.js`
- If the initial HTML is minimal/stub content, it's likely an SPA
- **SPA sites require Playwright** - webfetch cannot execute JavaScript

```bash
# Quick test: fetch with webfetch and check for JS-only content
# If you see "enable JavaScript" messages, use Playwright
```

---

## Q: How do I scrape authenticated/spa job portals efficiently?

**A**: Use the Playwright route interception pattern:

1. **Capture auth from browser requests** - Don't try to reverse-engineer auth; capture it from the browser
2. **Intercept initial API call** - Route handlers capture headers (`token`, `portalid`, etc.)
3. **Switch to direct API calls** - After getting auth headers, bypass DOM and call APIs directly
4. **Paginate via API** - Much faster than clicking through pages

**Code pattern**:
```typescript
await page.route('**/searchjobsportal', async (route, request) => {
  apiHeaders = request.headers();  // Capture auth headers
  const response = await route.fetch();
  // ... handle initial data
  await route.fulfill({ response });
});
// After page loads, use context.request.get(url, { headers }) for pagination
```

---

## Q: What headers are typically required for job portal APIs?

**A**: Common required headers (varies by site):
- `a` or `token` - Authentication token from URL params
- `portalid` - Dynamic per portal/site
- `token` - Session token from browser request
- `Accept: */*`

**Always capture from actual browser requests** - don't try to construct them manually.

---

## Q: How do I scrape multiple job portals in parallel?

**A**: Each portal needs its own browser context for separate auth:

```typescript
async function scrapePortal(portal: Portal) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();  // Fresh context per portal
  // ... scrape logic
  await browser.close();
}

// Run all in parallel
const results = await Promise.all(
  portals.map(portal => scrapePortal(portal))
);
```

**Don't share contexts** - auth tokens are portal-specific.

---

## Q: Should I parse/clean the scraped data?

**A**: **No! Raw data is better.** 

LLMs will parse the output later. Your job is just to fetch:
- Preserve full `jobDescription` text exactly as received - no truncation, no cleaning
- Keep all fields as strings - LLMs handle parsing/formatting
- Don't extract keywords or summarize - that's for downstream agents
- Simpler scrapers are more reliable and faster to write

**The pipeline is: Scraper (fast fetch) → Raw JSON → LLM Agent (parse & filter)**

---

## Q: How should I structure scraped job data?

**A**: Output JSON with consistent fields:

```typescript
interface ScrapeResult {
  scrapeDate: string;      // ISO timestamp
  portalUrl: string;       // Source portal
  portalId: string;        // Dynamic ID if applicable
  source: string;          // Human-readable name
  totalJobs: number;
  jobs: {
    id: number;           // Internal ID for URL construction
    refNo: string;         // Reference number (e.g., "26-00271")
    title: string;
    location: string;
    payRate: string | null;
    payFrequency: string | null;
    jobDescription: string;
    postDate: number;
    url: string;           // Direct link to job
  }[];
}
```

---

## Q: Where should scraped data be stored?

**A**: Use a consistent location for raw scrape output:
- `private/raw_webpages/` - Raw JSON files with datetime stamps
- Filename: `{source}_jobs_YYYY-MM-DDTHH-MM-SS.json`

Sub-agents can then process the JSON into structured YAML files.

---

## Q: How do I handle rate limiting and errors?

**A**: 
- Add delays between pagination calls (site-dependent)
- Use try/catch around browser operations
- Return partial results on failure - don't lose data
- Save results incrementally if possible
- Set reasonable timeouts (60s for page loads, 5min total)

---

## Q: What about simple server-rendered sites (ASP.NET, PHP, classic HTML)?

**A**: Use simple HTTP requests - no Playwright needed!

Classic server-rendered sites (ASP.NET WebForms, PHP, JSP) return complete HTML with job data:

```typescript
// Simple fetch + HTML parsing
const html = await fetch(url).then(r => r.text());

const jobs = html.split('job-listing-row').slice(1).map(block => ({
  id: block.match(/id=(\d+)/)?.[1],
  url: `...&id=${id}`,
  rawHtml: block  // LLM parses later
}));
```

**Benefits**:
- No browser overhead - fast and lightweight
- Rate limiting less of an issue than headless browsers
- Raw HTML is self-documenting for LLM parsing
- Works with curl/wget for debugging

**Indicators of server-rendered**:
- Jobs visible in `curl` output
- No `<noscript>enable JavaScript</noscript>` warning
- `.aspx`, `.php`, `.jsp` URLs
- Multiple job entries in initial HTML

---

## Q: What if I don't know the page structure?

**A**: Use Playwright MCP tools for interactive exploration:
1. Navigate to the site with `playwright_browser_navigate`
2. Take snapshots with `playwright_browser_snapshot`
3. Inspect elements, find selectors, test interactions
4. Once structure is known, write the permanent scraper script

---

## Q: How do I add a new job portal to the scraper?

**A**: Add to the `PORTALS` array in `scrapers/scrape_all_portals.ts`:

```typescript
const PORTALS: Portal[] = [
  {
    url: 'https://example.com/portal?a=TOKEN#/',
    name: 'Human Readable Name',
    outputName: 'filename_prefix'
  }
];
```

Each portal uses the same scraping logic (JobDiva-specific). For different platforms, create a new scraper script.