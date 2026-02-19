# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Resume builder that converts YAML resumes to HTML/CSS and PDF using TypeScript, Puppeteer, and pdf-lib. Designed to create ATS-friendly, single-page resumes with custom branding.

## Project Structure

```
/resume/
├── package.json          # Dependencies and npm scripts
├── tsconfig.json         # TypeScript configuration (ES2022, ESNext, strict mode)
├── AGENTS.md             # This file - guidelines for AI agents
├── scripts/
│   ├── build-pdf.ts      # Generates HTML/CSS/PDF from YAML
│   └── check-pages.ts    # Validates PDF is <= 1 page
├── current/              # Resume versions (each subfolder is a resume)
│   └── main/
│       ├── README.md     # Description of the resume's purpose/target role
│       ├── resume.yaml   # Resume content (edit this)
│       └── output/       # Generated files (index.html, styles.css, resume.pdf)
├── scoring_sheets/       # Resume evaluation rubrics (created by agents)
├── private/
│   └── example_resumes/  # Example resumes for scoring development
│       └── <role>/
│           ├── resume.yaml
│           ├── critique.md
│           ├── well-done.md
│           └── scoring-result.md
├── .opencode/
│   └── agents/           # Custom opencode agent definitions
│       ├── resume-scoring-sheet.md
│       └── resume-scorer.md
└── old_resumes/          # Reference materials
```

## Commands

All commands should be run from the repository root.

```bash
# Install dependencies
npm install

# Build a specific resume version
npm run build:main

# Validate PDF page count (must be <= 1 page)
npm run check:main

# Run scripts directly for other resume versions
ts-node-esm scripts/build-pdf.ts current/<version>
ts-node-esm scripts/check-pages.ts current/<version>
```

To add a new resume script, edit `package.json`:
```json
"scripts": {
  "build:<name>": "ts-node-esm scripts/build-pdf.ts current/<name>",
  "check:<name>": "ts-node-esm scripts/check-pages.ts current/<name>"
}
```

## Code Style

### TypeScript

- **Target**: ES2022, ESNext modules
- **Strict mode**: Enabled (`strict: true` in tsconfig.json)
- **Module type**: ESM (`"type": "module"` in package.json)
- **Imports**: Use ES module syntax with explicit file extensions not required
  ```typescript
  import puppeteer from 'puppeteer';
  import { marked } from 'marked';
  import { readFileSync, writeFileSync } from 'fs';
  ```

### Naming Conventions

- **Files**: kebab-case (e.g., `build-pdf.ts`, `check-pages.ts`)
- **Interfaces**: PascalCase (e.g., `Resume`, `Experience`, `Education`)
- **Functions**: camelCase (e.g., `generateHtml`, `buildPdf`)
- **Constants**: camelCase for regular, UPPER_SNAKE_CASE for true constants
- **CSS classes**: kebab-case (e.g., `.skill-label`, `.job-header`)

### Code Patterns

- Use `async/await` for asynchronous operations
- Use template literals for HTML generation
- Use `console.error` for errors, `console.log` for success messages
- Exit with `process.exit(1)` on errors, `process.exit(0)` on success

### Error Handling

```typescript
// Check prerequisites early
if (!existsSync(yamlPath)) {
  console.error(`Resume YAML not found: ${yamlPath}`);
  process.exit(1);
}

// Use try/finally for resource cleanup
try {
  // operations
} finally {
  await browser.close();
}

// Catch top-level errors
mainFunction().catch(console.error);
```

## Resume YAML Schema

```yaml
name: string
location: string
phone: string
email: string
linkedin:
  text: string
  url: string
summary: string
experience:
  - company: string
    dates: string
    title: string
    achievements: string[]  # Supports **markdown** *formatting*
education:
  - school: string
    dates: string
    degree: string
skills:
  - label: string
    items: string
```

## Color Scheme

Defined in CSS variables:
- `--primary-color: #c36f09` (ochre/orange) - main elements, section titles
- `--secondary-color: #296600` (olive green) - company names, school names, dates
- `--accent-color: #562446` (blackberry cream/purple) - borders, separators
- `--highlight-color: #de5489` (blush rose/pink) - bold text in achievements
- `--text-color: #1a1a1a` - body text

## PDF Generation

- **Format**: US Letter (8.5" x 11")
- **Margins**: 0.25" top/bottom, 0.4" left/right
- **Requirement**: Must be exactly 1 page (validated by `check-pages.ts`)
- Uses Puppeteer with headless Chrome for rendering

## Adding a New Resume Version

1. Create directory: `mkdir current/<name>`
2. Create `resume.yaml` with content
3. Add npm scripts to `package.json`
4. Run: `npm run build:<name> && npm run check:<name>`

## Resume Scoring Agents

This project uses custom opencode agents for resume evaluation:

### Available Agents

1. **@resume-scoring-sheet** - Creates scoring rubrics for specific roles
2. **@resume-scorer** - Evaluates resumes against scoring sheets

### Usage Examples

**Create a scoring sheet:**
```
@resume-scoring-sheet Create a scoring sheet for senior software engineering resumes
```

**Score your resume:**
```
@resume-scorer Score current/main/resume.yaml against scoring_sheets/software-engineer-senior.yaml
```

**Use example resumes for reference:**
```
@resume-scoring-sheet Create a scoring sheet for product management resumes, using examples from private/example_resumes/pm/
```

### Folder Conventions

- **scoring_sheets/** - Store all scoring rubrics here (YAML or Markdown)
- **private/example_resumes/**<role>/ - Store example resumes with:
  - `resume.yaml` or `resume.pdf` - the resume file
  - `critique.md` - detailed issues found
  - `well-done.md` - strengths and positive aspects
  - `scoring-result.md` - generated scoring results

## Notes

- Output files (HTML, CSS, PDF) are regenerated on each build - do not edit directly
- Edit `resume.yaml` for content changes
- Edit CSS in `build-pdf.ts` `generateStyles()` function for styling changes
- Always run `check:<name>` after `build:<name>` to validate page count