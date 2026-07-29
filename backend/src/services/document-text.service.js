const mammoth = require('mammoth');
const pdfService = require('./pdf.service');
const ocrService = require('./ocr.service');

const MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  TIFF: 'image/tiff',
  BMP: 'image/bmp',
  TXT: 'text/plain',
};

const DOC_MIME_TYPES = new Set([
  'application/msword',
  'application/x-msword',
  'application/vnd.ms-word',
  'application/doc',
  'application/x-doc',
]);

const MIN_READABLE_CHARS = 50;
const PAGE_OCR_THRESHOLD_CHARS = 100;

const PLACEHOLDER_TEXTS = new Set([
  'Seeded MLN131 study material uploaded from real PDF source.',
  'Seeded personal document categorized as Other.',
]);
const IMAGE_MIME_TYPES = new Set([
  MIME_TYPES.PNG,
  MIME_TYPES.JPEG,
  MIME_TYPES.TIFF,
  MIME_TYPES.BMP,
]);

function normalizeText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isExtractedTextUseful(text) {
  const normalizedText = normalizeText(text);
  if (normalizedText.length < MIN_READABLE_CHARS) return false;
  return !PLACEHOLDER_TEXTS.has(normalizedText);
}

function extractBinaryDocText(buffer) {
  const strUtf16 = buffer.toString('utf16le');
  const matchesUtf16 = strUtf16.match(/[\x20-\x7E\xA0-\xFF\u0100-\u024F\u1EA0-\u1EF9]{4,}/g) || [];

  const strAscii = buffer.toString('binary');
  const matchesAscii = strAscii.match(/[\x20-\x7E\xA0-\xFF\u0100-\u024F\u1EA0-\u1EF9]{4,}/g) || [];

  const combined = [...matchesUtf16, ...matchesAscii]
    .filter((s) => s.trim().length > 3)
    .join(' ');
  return normalizeText(combined);
}

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.trim().length > 10) {
      return result.value;
    }
  } catch {
    // If mammoth fails (e.g. legacy binary DOC file), fallback to binary text extraction
  }
  return extractBinaryDocText(buffer);
}

function buildExtractionResult(text, metadata = {}, emptyError) {
  const normalizedText = normalizeText(text);

  if (!isExtractedTextUseful(normalizedText)) {
    return {
      text: normalizedText,
      status: 'empty',
      error: emptyError || 'No readable text could be extracted from this file.',
      metadata,
    };
  }

  return {
    text: normalizedText,
    status: 'ready',
    error: null,
    metadata,
  };
}

function buildOcrFailureResult({ error, metadata = {}, fallbackFromPdfParse = false }) {
  return {
    text: '',
    status: 'empty',
    error: error.message || 'OCR could not extract readable text from this file.',
    metadata: {
      extractionMethod: 'ocr',
      fallbackFromPdfParse,
      ...(error.ocrMetadata || {}),
      ...metadata,
    },
  };
}

/**
 * Hybrid Page-Level PDF Text Extraction.
 * Splits PDF page-by-page. For each page:
 * 1. Extract text using pdf-parse.
 * 2. If page text length (excluding whitespace) < 100 chars, runs OCR for that page.
 * 3. Constructs exact pageBoundaries metadata for chunk mapping.
 * 4. Falls back safely to whole-buffer processing if page splitting fails.
 */
async function extractPdfText(buffer) {
  const pageEntries = await pdfService.splitPdfPages(buffer);

  if (Array.isArray(pageEntries) && pageEntries.length > 0) {
    const textParts = [];
    const pageBoundaries = [];
    let cumulativeOffset = 0;
    let ocrCount = 0;

    for (const page of pageEntries) {
      const { pageNumber, buffer: pageBuffer } = page;
      let rawPageText = await pdfService.extractPageText(pageBuffer);
      let cleanPageText = normalizeText(rawPageText);

      // Check if page needs OCR (< 100 non-whitespace characters)
      const nonSpaceLength = cleanPageText.replace(/\s+/g, '').length;
      if (nonSpaceLength < PAGE_OCR_THRESHOLD_CHARS) {
        try {
          const pageOcr = await ocrService.extractPdfText(pageBuffer);
          const ocrText = normalizeText(pageOcr?.text);
          if (ocrText && ocrText.replace(/\s+/g, '').length > nonSpaceLength) {
            cleanPageText = ocrText;
            ocrCount += 1;
          }
        } catch {
          // Ignore single-page OCR error and keep pdf-parse text
        }
      }

      if (cleanPageText) {
        if (textParts.length > 0) {
          cumulativeOffset += 2; // '\n\n' separator length
        }
        const startChar = cumulativeOffset;
        textParts.push(cleanPageText);
        cumulativeOffset += cleanPageText.length;

        pageBoundaries.push({
          pageNumber,
          startChar,
          endChar: cumulativeOffset,
        });
      }
    }

    const fullText = textParts.join('\n\n');
    if (isExtractedTextUseful(fullText)) {
      return {
        text: fullText,
        status: 'ready',
        error: null,
        metadata: {
          extractionMethod: ocrCount > 0 ? 'hybrid-page-ocr' : 'hybrid-page-pdf-parse',
          ocrPagesCount: ocrCount,
          totalPagesCount: pageEntries.length,
          pageBoundaries,
        },
      };
    }
  }

  // Safe Fallback for encrypted, corrupted, or unsplittable PDFs
  const pdfText = normalizeText(await pdfService.extractText(buffer));
  if (isExtractedTextUseful(pdfText)) {
    return {
      text: pdfText,
      status: 'ready',
      error: null,
      metadata: {
        extractionMethod: 'pdf-parse-fallback',
        fallbackFromPdfParse: false,
      },
    };
  }

  try {
    const ocr = await ocrService.extractPdfText(buffer);
    return buildExtractionResult(
      ocr.text,
      {
        extractionMethod: 'ocr-fallback',
        fallbackFromPdfParse: true,
        ...ocr.metadata,
      },
      'No readable text could be extracted from this scanned PDF.'
    );
  } catch (err) {
    return buildOcrFailureResult({
      error: err,
      fallbackFromPdfParse: true,
      metadata: {
        pdfParseTextLength: pdfText.length,
      },
    });
  }
}

async function extractImageText(buffer, mimeType) {
  try {
    const ocr = await ocrService.extractImageText(buffer, mimeType);
    return buildExtractionResult(
      ocr.text,
      {
        extractionMethod: 'ocr',
        fallbackFromPdfParse: false,
        ...ocr.metadata,
      },
      'No readable text could be extracted from this image.'
    );
  } catch (err) {
    return buildOcrFailureResult({
      error: err,
      fallbackFromPdfParse: false,
    });
  }
}

async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === MIME_TYPES.PDF) {
    return extractPdfText(buffer);
  }

  if (mimeType === MIME_TYPES.DOCX || DOC_MIME_TYPES.has(mimeType)) {
    return buildExtractionResult(await extractDocxText(buffer), {
      extractionMethod: 'docx',
      fallbackFromPdfParse: false,
    });
  }

  if (mimeType === MIME_TYPES.TXT) {
    return buildExtractionResult(buffer.toString('utf8'), {
      extractionMethod: 'plain-text',
      fallbackFromPdfParse: false,
    });
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return extractImageText(buffer, mimeType);
  }

  const err = new Error('Unsupported document type');
  err.statusCode = 400;
  err.publicMessage = 'Only PDF, DOCX, DOC, TXT, PNG, JPEG, TIFF, and BMP files are accepted';
  throw err;
}

module.exports = {
  extractTextFromBuffer,
  isExtractedTextUseful,
  normalizeText,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
};
