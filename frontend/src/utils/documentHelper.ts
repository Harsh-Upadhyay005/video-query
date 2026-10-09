/**
 * Utilities for processing, cleaning, and formatting PDF document text and summaries.
 */

export interface DocumentPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

export interface DocumentAnalysisInfo {
  isDocument: boolean;
  pages: DocumentPage[];
  totalPages: number;
  totalWords: number;
  readingTimeMinutes: number;
  extractedSummary?: {
    overview: string;
    takeaways: string[];
    coreThemes: string[];
  };
}

/**
 * Checks whether an analysis payload represents a PDF or document
 */
export function isDocumentAnalysis(data: any): boolean {
  if (!data) return false;

  const sourceType = (data.source_type || data.type || '').toLowerCase();
  if (sourceType === 'pdf' || sourceType === 'document') return true;

  if (data.transcript_source === 'document') return true;

  // If no video_id and has page markers or title ends with .pdf
  const title = (data.title || '').toLowerCase();
  if (title.endsWith('.pdf')) return true;

  const transcript = typeof data.transcript === 'string' ? data.transcript : '';
  if (!data.video_id && (transcript.includes('[Page ') || transcript.includes('Page 1'))) {
    return true;
  }

  // If there are no video segments and it contains page indicators
  if ((!data.segments || data.segments.length === 0) && /\[Page\s*\d+\]/i.test(transcript)) {
    return true;
  }

  return false;
}

/**
 * De-duplicates adjacent repeated strings (e.g., "Robert T. KiyosakiRobert T. Kiyosaki")
 */
function deduplicateRepeatedHeaders(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length >= 8 && trimmed.length % 2 === 0) {
    const half = trimmed.length / 2;
    const firstHalf = trimmed.slice(0, half);
    const secondHalf = trimmed.slice(half);
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }
  return line;
}

/**
 * Normalizes vertically split characters (e.g. W\nh\na\nt -> What)
 * and joins broken lines into readable sentences and paragraphs.
 */
export function cleanDocumentText(rawText: string): string {
  if (!rawText) return '';

  // Normalize newlines
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Fix words split across lines by hyphens (e.g., "intel-\nlectual" -> "intellectual")
  text = text.replace(/([A-Za-z]+)-\n([A-Za-z]+)/g, '$1$2');

  // Split text into lines to detect runs of single characters (vertical text extraction)
  const rawLines = text.split('\n');
  const processedLines: string[] = [];

  let singleCharBuffer: string[] = [];

  const flushSingleCharBuffer = () => {
    if (singleCharBuffer.length > 0) {
      // Join single characters into word(s)
      const reconstructed = singleCharBuffer.join('').trim();
      if (reconstructed) {
        processedLines.push(reconstructed);
      }
      singleCharBuffer = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Check if line is a single character (letter, digit, or single symbol)
    if (trimmed.length === 1 && !/^\[\d+\]$/.test(trimmed)) {
      singleCharBuffer.push(trimmed);
    } else if (trimmed.length === 0) {
      // Empty line: if we have a single char buffer, add a space to separate words
      if (singleCharBuffer.length >= 2) {
        singleCharBuffer.push(' ');
      } else {
        flushSingleCharBuffer();
        processedLines.push('');
      }
    } else {
      flushSingleCharBuffer();
      processedLines.push(deduplicateRepeatedHeaders(line));
    }
  }
  flushSingleCharBuffer();

  let cleaned = processedLines.join('\n');

  // Collapse 3+ consecutive newlines to double newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Smooth out unnatural line-breaks within normal sentences while preserving headers and page markers
  const paragraphs = cleaned.split('\n\n');
  const formattedParagraphs = paragraphs.map((para) => {
    const trimmedPara = para.trim();
    if (!trimmedPara) return '';

    // If it's a page marker, leave intact
    if (/^\[Page\s*\d+\]/i.test(trimmedPara)) {
      return trimmedPara;
    }

    // If the paragraph is already short or looks like a title/heading, preserve lines
    const lines = trimmedPara.split('\n');
    if (lines.length <= 1) return trimmedPara;

    // Join lines with space if they don't look like bullet points or list items
    const isList = lines.some((l) => /^\s*([-*•\d+.)]|\b\d+\.)\s+/.test(l));
    if (isList) {
      return lines.join('\n');
    }

    return lines.map((l) => l.trim()).join(' ');
  });

  return formattedParagraphs.filter(Boolean).join('\n\n');
}

/**
 * Parses raw text into page objects, respecting [Page X] markers or segmenting naturally.
 */
export function parseDocumentPages(rawText: string): DocumentPage[] {
  if (!rawText || !rawText.trim()) return [];

  const cleaned = cleanDocumentText(rawText);
  const pageRegex = /\[Page\s*(\d+)\]/gi;

  const matches: { index: number; pageNum: number; length: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pageRegex.exec(cleaned)) !== null) {
    matches.push({
      index: match.index,
      pageNum: parseInt(match[1], 10),
      length: match[0].length,
    });
  }

  // If page markers were found, split along them
  if (matches.length > 0) {
    const pages: DocumentPage[] = [];

    // Content before first [Page] marker if any
    if (matches[0].index > 0) {
      const preamble = cleaned.substring(0, matches[0].index).trim();
      if (preamble.length > 20) {
        pages.push({
          pageNumber: 1,
          text: preamble,
          wordCount: countWords(preamble),
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.length;
      const end = i + 1 < matches.length ? matches[i + 1].index : cleaned.length;

      const pageContent = cleaned.substring(start, end).trim();
      pages.push({
        pageNumber: current.pageNum || i + 1,
        text: pageContent || '(No text content on this page)',
        wordCount: countWords(pageContent),
      });
    }

    return pages;
  }

  // Fallback: Segment by ~400 words per page if no [Page X] tags exist
  const paragraphs = cleaned.split('\n\n');
  const pages: DocumentPage[] = [];
  let currentPageText: string[] = [];
  let currentWords = 0;
  let pageNum = 1;

  for (const para of paragraphs) {
    const wordsInPara = countWords(para);
    if (currentWords + wordsInPara > 450 && currentPageText.length > 0) {
      const pageText = currentPageText.join('\n\n');
      pages.push({
        pageNumber: pageNum++,
        text: pageText,
        wordCount: countWords(pageText),
      });
      currentPageText = [para];
      currentWords = wordsInPara;
    } else {
      currentPageText.push(para);
      currentWords += wordsInPara;
    }
  }

  if (currentPageText.length > 0) {
    const pageText = currentPageText.join('\n\n');
    pages.push({
      pageNumber: pageNum,
      text: pageText,
      wordCount: countWords(pageText),
    });
  }

  return pages.length > 0
    ? pages
    : [
        {
          pageNumber: 1,
          text: cleaned,
          wordCount: countWords(cleaned),
        },
      ];
}

/**
 * Counts words in a string
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts a structured summary and key takeaways from document text if no AI summary is stored.
 */
export function extractStructuredSummary(cleanedText: string, title?: string): {
  overview: string;
  takeaways: string[];
  coreThemes: string[];
} {
  const paragraphs = cleanedText
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 40 && !/^\[Page\s*\d+\]/i.test(p));

  // Build overview from the first substantive paragraphs
  let overview = '';
  if (paragraphs.length > 0) {
    overview = paragraphs.slice(0, 3).join('\n\n');
  } else {
    overview = `Document analysis for "${title || 'Uploaded Document'}". Contains structured text content ready for exploration.`;
  }

  // Extract key sentences / takeaways across the document
  const allSentences = cleanedText
    .replace(/\[Page\s*\d+\]/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && s.length < 220 && !s.includes('\n'));

  const takeaways: string[] = [];
  const step = Math.max(1, Math.floor(allSentences.length / 6));

  for (let i = 0; i < allSentences.length && takeaways.length < 5; i += step) {
    const s = allSentences[i];
    if (s && !takeaways.includes(s)) {
      takeaways.push(s);
    }
  }

  // Fallback takeaways if document is brief
  if (takeaways.length === 0 && paragraphs.length > 0) {
    takeaways.push(paragraphs[0].slice(0, 160) + '...');
  }

  // Dynamically extract core themes from document headings or prominent capitalized terms
  const coreThemes: string[] = [];
  const headingRegex = /(?:^|\n)(?:Chapter\s+\d+[:\s]*[^\n]+|Section\s+\d+[:\s]*[^\n]+|[A-Z][A-Za-z\s]{4,30})(?=\n|$)/g;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingRegex.exec(cleanedText)) !== null && coreThemes.length < 5) {
    const candidate = hMatch[0].trim();
    if (candidate.length > 4 && candidate.length < 40 && !candidate.startsWith('[Page') && !coreThemes.includes(candidate)) {
      coreThemes.push(candidate);
    }
  }

  // If no heading matches found, provide adaptive fallback based on title
  if (coreThemes.length === 0) {
    if (title) {
      coreThemes.push(title, 'Core Principles', 'Key Insights', 'Analysis');
    } else {
      coreThemes.push('Executive Overview', 'Key Concepts', 'Essential Points');
    }
  }

  return {
    overview,
    takeaways,
    coreThemes,
  };
}

/**
 * High-level helper to analyze and structure document data
 */
export function processDocumentData(data: any): DocumentAnalysisInfo {
  const isDoc = isDocumentAnalysis(data);
  const rawText = data?.transcript || '';
  const pages = parseDocumentPages(rawText);
  const totalWords = countWords(cleanDocumentText(rawText));
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

  let extractedSummary = undefined;
  if (!data?.summary && rawText) {
    extractedSummary = extractStructuredSummary(cleanDocumentText(rawText), data?.title);
  }

  return {
    isDocument: isDoc,
    pages,
    totalPages: pages.length,
    totalWords,
    readingTimeMinutes,
    extractedSummary,
  };
}
