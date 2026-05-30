const mammoth = require('mammoth');
const pdfService = require('./pdf.service');

const MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const MIN_READABLE_CHARS = 40;

function normalizeText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractTextFromBuffer(buffer, mimeType) {
  let rawText = '';

  if (mimeType === MIME_TYPES.PDF) {
    rawText = await pdfService.extractText(buffer);
  } else if (mimeType === MIME_TYPES.DOCX) {
    rawText = await extractDocxText(buffer);
  } else {
    const err = new Error('Unsupported document type');
    err.statusCode = 400;
    err.publicMessage = 'Only PDF and DOCX files are accepted';
    throw err;
  }

  const text = normalizeText(rawText);

  if (text.length < MIN_READABLE_CHARS) {
    return {
      text,
      status: 'empty',
      error: 'No readable text could be extracted. Scanned PDFs are not supported yet.',
    };
  }

  return {
    text,
    status: 'ready',
    error: null,
  };
}

module.exports = {
  extractTextFromBuffer,
  normalizeText,
  MIME_TYPES,
};
