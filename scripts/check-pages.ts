import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function checkPageCount(resumePath: string): Promise<void> {
  const resumeDir = join(rootDir, resumePath);
  const pdfPath = join(resumeDir, 'output', 'resume.pdf');

  if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    console.error('Run the build script first.');
    process.exit(1);
  }

  try {
    const pdfBytes = readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    console.log(`PDF has ${pageCount} page(s)`);

    if (pageCount > 1) {
      console.error('ERROR: Resume exceeds 1 page!');
      process.exit(1);
    } else {
      console.log('SUCCESS: Resume fits on 1 page');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error reading PDF:', error);
    process.exit(1);
  }
}

const resumePath = process.argv[2];
if (!resumePath) {
  console.error('Usage: ts-node-esm scripts/check-pages.ts <resume-path>');
  console.error('Example: ts-node-esm scripts/check-pages.ts current/main');
  process.exit(1);
}

checkPageCount(resumePath);