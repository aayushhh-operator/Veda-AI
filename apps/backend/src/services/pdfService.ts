import puppeteer from 'puppeteer';
import type { GeneratedPaper } from '@vedaai/shared';

// ─── Difficulty Badge Colors ─────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#d4edda', text: '#155724' },
  medium: { bg: '#fff3cd', text: '#856404' },
  hard: { bg: '#f8d7da', text: '#721c24' },
};

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildPaperHTML(paper: GeneratedPaper): string {
  const sectionsHtml = paper.sections
    .map((section: any, sIdx: number) => {
      const questionsHtml = section.questions
        .map((q: any, qIdx: number) => {
          const questionNum = qIdx + 1;
          const diffColor = DIFFICULTY_COLORS[q.difficulty] || DIFFICULTY_COLORS.medium;

          const diffBadge = `<span style="
            display: inline-block;
            font-size: 9px;
            padding: 1px 6px;
            border-radius: 3px;
            background: ${diffColor.bg};
            color: ${diffColor.text};
            margin-left: 8px;
            vertical-align: middle;
            font-family: sans-serif;
          ">${q.difficulty.toUpperCase()}</span>`;

          let questionBody = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div style="flex: 1;">
                <span style="font-weight: 600;">${questionNum}.</span> ${q.text} ${diffBadge}
              </div>
              <div style="white-space: nowrap; margin-left: 16px; font-weight: 600; color: #444;">
                [${q.marks}M]
              </div>
            </div>`;

          if (q.type === 'mcq' && q.options && q.options.length === 4) {
            const labels = ['A', 'B', 'C', 'D'];
            const optionsHtml = q.options
              .map(
                (opt: string, oIdx: number) =>
                  `<div style="padding: 2px 0;">${labels[oIdx]}) ${opt}</div>`,
              )
              .join('');

            questionBody += `
              <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2px 24px;
                margin-left: 24px;
                margin-top: 4px;
                margin-bottom: 8px;
              ">${optionsHtml}</div>`;
          }

          return `<div style="margin-bottom: 16px;">${questionBody}</div>`;
        })
        .join('');

      return `
        <div style="margin-bottom: 28px; ${sIdx > 0 ? 'page-break-before: auto;' : ''}">
          <h2 style="
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 4px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #333;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${section.title}</h2>
          <p style="
            font-style: italic;
            color: #555;
            margin: 4px 0 16px 0;
            font-size: 12px;
          ">${section.instruction} &nbsp; (${section.totalMarks} Marks)</p>
          ${questionsHtml}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 20mm 18mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 13px;
      line-height: 1.5;
      color: #222;
    }
  </style>
</head>
<body>
  <!-- School Header -->
  <div style="
    text-align: center;
    border: 3px double #333;
    padding: 16px 24px;
    margin-bottom: 16px;
  ">
    <h1 style="
      font-size: 22px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    ">${paper.schoolName}</h1>
    <p style="font-size: 11px; color: #666; margin-top: 2px;">Academic Assessment</p>
  </div>

  <!-- Info Bar -->
  <div style="
    display: flex;
    justify-content: space-between;
    background: #f4f4f4;
    border: 1px solid #ccc;
    padding: 8px 16px;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 600;
  ">
    <span>Subject: ${paper.subject}</span>
    <span>Grade: ${paper.grade}</span>
    <span>Duration: ${paper.duration} min</span>
    <span>Total Marks: ${paper.totalMarks}</span>
  </div>

  <!-- Student Info -->
  <div style="
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    font-size: 12px;
    padding: 0 4px;
  ">
    <span>Name: _______________________________</span>
    <span>Roll Number: _______________</span>
    <span>Section: ___________</span>
  </div>

  <hr style="border: none; border-top: 1px solid #aaa; margin-bottom: 20px;" />

  <!-- Sections -->
  ${sectionsHtml}

  <!-- Footer -->
  <div style="
    text-align: center;
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 11px;
    color: #888;
    font-family: sans-serif;
  ">
    *** End of Question Paper ***
  </div>
</body>
</html>`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

export async function generatePDF(paper: GeneratedPaper): Promise<Buffer> {
  const html = buildPaperHTML(paper);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' as any });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '18mm',
        right: '18mm',
      },
    });

    // Puppeteer returns Uint8Array in newer versions; ensure we return a Buffer
    return Buffer.from(pdfBuffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`PDF generation failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
