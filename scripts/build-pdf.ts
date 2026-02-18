import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

interface LinkedIn {
  text: string;
  url: string;
}

interface Resume {
  name: string;
  location: string;
  phone: string;
  email: string;
  linkedin: LinkedIn;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
}

interface Experience {
  company: string;
  dates: string;
  title: string;
  achievements: string[];
}

interface Education {
  school: string;
  dates: string;
  degree: string;
}

interface Skill {
  label: string;
  items: string;
}

function generateStyles(): string {
  return `:root {
  --blackberry-cream: #562446;
  --olive-leaf: #296600;
  --ochre: #c36f09;
  --beige: #ecedd4;
  --blush-rose: #de5489;
  --text-color: #1a1a1a;
  --primary-color: #c36f09;
  --secondary-color: #296600;
  --accent-color: #562446;
  --highlight-color: #de5489;
  --bg-color: #ffffff;
}

@media screen {
  body {
    background-color: #f5f5f5;
    padding: 20px;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 9.5pt;
  line-height: 1.25;
  color: var(--text-color);
}

.resume {
  width: 8.5in;
  margin: 0 auto;
  background: var(--bg-color);
  padding: 0.25in 0.4in;
}

.header {
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--accent-color);
}

.name {
  font-size: 20pt;
  font-weight: 700;
  color: var(--primary-color);
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.contact-info {
  font-size: 9.5pt;
  color: var(--text-color);
}

.contact-info a {
  color: var(--text-color);
  text-decoration: none;
}

.contact-info a:hover {
  text-decoration: underline;
}

.contact-info .separator {
  margin: 0 6px;
  color: var(--accent-color);
}

.section {
  margin-bottom: 8px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 10pt;
  font-weight: 700;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--accent-color);
  padding-bottom: 2px;
  margin-bottom: 5px;
}

.summary {
  text-align: justify;
  margin-bottom: 4px;
  line-height: 1.3;
}

.job {
  margin-bottom: 8px;
}

.job:last-child {
  margin-bottom: 0;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.company {
  font-size: 10.5pt;
  font-weight: 700;
  color: var(--secondary-color);
}

.dates {
  font-size: 9.5pt;
  color: var(--secondary-color);
  font-weight: 600;
}

.job-title {
  font-size: 9.5pt;
  font-style: italic;
  color: var(--text-color);
  margin-bottom: 4px;
}

.achievements {
  padding-left: 16px;
  list-style-type: disc;
}

.achievements li {
  margin-bottom: 5px;
  text-align: justify;
  line-height: 1.2;
}

.achievements li:last-child {
  margin-bottom: 0;
}

.achievements li p {
  display: inline;
}

.achievements li strong {
  color: var(--highlight-color);
  font-weight: 700;
}

.achievements li em {
  font-style: italic;
}

.education {
  margin-bottom: 5px;
}

.education:last-child {
  margin-bottom: 0;
}

.education-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.school {
  font-size: 10pt;
  font-weight: 700;
  color: var(--secondary-color);
}

.degree {
  font-size: 9.5pt;
  font-style: italic;
}

.skills {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.skill-category {
  display: flex;
  align-items: baseline;
}

.skill-label {
  font-weight: 700;
  color: var(--primary-color);
  min-width: 80px;
  flex-shrink: 0;
}

.skill-items {
  color: var(--text-color);
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .resume {
    padding: 0.25in 0.4in;
    margin: 0;
  }
  
  .achievements li {
    orphans: 2;
    widows: 2;
  }
}`;
}

async function parseMarkdown(text: string): Promise<string> {
  const parsed = await marked.parseInline(text);
  return parsed;
}

async function generateHtml(data: Resume): Promise<string> {
  const escapeHtml = (str: string): string => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const experienceHtmlPromises = data.experience.map(async job => {
    const achievementsHtml = await Promise.all(
      job.achievements.map(async a => `<li>${await parseMarkdown(a)}</li>`)
    );
    return `
      <div class="job">
        <div class="job-header">
          <h3 class="company">${escapeHtml(job.company)}</h3>
          <span class="dates">${escapeHtml(job.dates)}</span>
        </div>
        <div class="job-title">${escapeHtml(job.title)}</div>
        <ul class="achievements">
          ${achievementsHtml.join('\n          ')}
        </ul>
      </div>`;
  });
  const experienceHtml = (await Promise.all(experienceHtmlPromises)).join('\n');

  const educationHtml = data.education.map(edu => `
      <div class="education">
        <div class="education-header">
          <h3 class="school">${escapeHtml(edu.school)}</h3>
          <span class="dates">${escapeHtml(edu.dates)}</span>
        </div>
        <div class="degree">${escapeHtml(edu.degree)}</div>
      </div>`).join('\n');

  const skillsHtml = data.skills.map(skill => `
        <div class="skill-category">
          <span class="skill-label">${escapeHtml(skill.label)}:</span>
          <span class="skill-items">${escapeHtml(skill.items)}</span>
        </div>`).join('\n');

  const linkedinLink = `<a href="${escapeHtml(data.linkedin.url)}" target="_blank">${escapeHtml(data.linkedin.text)}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.name)} - Resume</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="resume">
    <header class="header">
      <h1 class="name">${escapeHtml(data.name)}</h1>
      <div class="contact-info">
        <span>${escapeHtml(data.location)}</span>
        <span class="separator">|</span>
        <span>${escapeHtml(data.phone)}</span>
        <span class="separator">|</span>
        <span>${escapeHtml(data.email)}</span>
        <span class="separator">|</span>
        <span>${linkedinLink}</span>
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">Summary</h2>
      <p class="summary">${escapeHtml(data.summary.trim())}</p>
    </section>

    <section class="section">
      <h2 class="section-title">Experience</h2>
${experienceHtml}
    </section>

    <section class="section">
      <h2 class="section-title">Education</h2>
${educationHtml}
    </section>

    <section class="section">
      <h2 class="section-title">Skills</h2>
      <div class="skills">
${skillsHtml}
      </div>
    </section>
  </div>
</body>
</html>`;
}

async function buildPdf(resumePath: string): Promise<void> {
  const resumeDir = join(rootDir, resumePath);
  const yamlPath = join(resumeDir, 'resume.yaml');
  const outputDir = join(resumeDir, 'output');

  if (!existsSync(yamlPath)) {
    console.error(`Resume YAML not found: ${yamlPath}`);
    process.exit(1);
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const yamlContent = readFileSync(yamlPath, 'utf8');
  const data = yaml.load(yamlContent) as Resume;

  const html = await generateHtml(data);
  const css = generateStyles();

  const htmlPath = join(outputDir, 'index.html');
  const cssPath = join(outputDir, 'styles.css');
  const pdfPath = join(outputDir, 'resume.pdf');

  writeFileSync(htmlPath, html);
  writeFileSync(cssPath, css);

  console.log(`HTML generated: ${htmlPath}`);
  console.log(`CSS generated: ${cssPath}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.25in',
        bottom: '0.25in',
        left: '0.4in',
        right: '0.4in'
      }
    });

    console.log(`PDF generated: ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

const resumePath = process.argv[2];
if (!resumePath) {
  console.error('Usage: ts-node-esm scripts/build-pdf.ts <resume-path>');
  console.error('Example: ts-node-esm scripts/build-pdf.ts current/main');
  process.exit(1);
}

buildPdf(resumePath).catch(console.error);