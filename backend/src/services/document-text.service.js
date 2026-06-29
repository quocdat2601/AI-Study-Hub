const mammoth = require('mammoth');
const pdfService = require('./pdf.service');
const ocrService = require('./ocr.service');

const MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  TIFF: 'image/tiff',
  BMP: 'image/bmp',
  TXT: 'text/plain',
};

const MIN_READABLE_CHARS = 50;
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

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
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

async function extractPdfText(buffer) {
  const pdfText = normalizeText(await pdfService.extractText(buffer));
  if (isExtractedTextUseful(pdfText)) {
    return {
      text: pdfText,
      status: 'ready',
      error: null,
      metadata: {
        extractionMethod: 'pdf-parse',
        fallbackFromPdfParse: false,
      },
    };
  }

  try {
    const ocr = await ocrService.extractPdfText(buffer);
    return buildExtractionResult(
      ocr.text,
      {
        extractionMethod: 'ocr',
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

  if (mimeType === MIME_TYPES.DOCX) {
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
  err.publicMessage = 'Only PDF, DOCX, TXT, PNG, JPEG, TIFF, and BMP files are accepted';
  throw err;
}

module.exports = {
  extractTextFromBuffer,
  isExtractedTextUseful,
  normalizeText,
  MIME_TYPES,
  IMAGE_MIME_TYPES,
};
