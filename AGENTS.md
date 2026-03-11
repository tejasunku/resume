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
│   ├── full/             # Complete work history - source of truth (can be >1 page)
│   │   ├── README.md     # Full resume documentation
│   │   ├── resume.yaml   # Complete unabridged resume
│   │   └── output/       # Generated files (HTML, CSS, PDF)
│   └── main/             # Primary 1-page resume for broad appeal
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

## Full Resume Maintenance

The `current/full/` directory contains the **complete, unabridged work history** - the source of truth for all other resume versions.

### Agent Guidelines

When working with resume content:
- **Never modify** `current/full/resume.yaml` without explicit user approval
- **Always prompt** the user to update the full resume when changes are made to other versions

### Prompt Template

After completing work on any resume variant, ask the user:

> "I've finished updating `current/<name>/resume.yaml`. Would you like me to also add these changes to `current/full/resume.yaml` to keep the complete history up to date?"

### What to Sync

When updating the full resume, ensure these are captured:
- New work experience entries
- Updated achievements or responsibilities
- New skills or technologies
- Modified education or certifications
- New projects or accomplishments

This maintains the full resume as the authoritative archive that other targeted resumes draw from.

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

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
