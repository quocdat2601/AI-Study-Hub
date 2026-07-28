const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

async function extractText(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractPageText(singlePageBuffer) {
  try {
    const data = await pdfParse(singlePageBuffer);
    return data.text || '';
  } catch {
    return '';
  }
}

/**
 * Splits a PDF buffer into individual single-page PDF buffers using pdf-lib.
 * Returns null if splitting fails (e.g. encrypted or corrupted PDF) to allow safe fallback.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ pageNumber: number, buffer: Buffer }> | null>}
 */
async function splitPdfPages(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    if (!pageCount || pageCount === 0) return [];

    const pages = [];
    for (let i = 0; i < pageCount; i += 1) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(pdfDoc, [i]);
      singleDoc.addPage(copiedPage);
      const pdfBytes = await singleDoc.save();
      pages.push({
        pageNumber: i + 1,
        buffer: Buffer.from(pdfBytes),
      });
    }

    return pages;
  } catch (err) {
    console.warn('pdf-lib could not split PDF pages (will fallback to whole buffer):', err.message);
    return null;
  }
}

module.exports = {
  extractText,
  extractPageText,
  splitPdfPages,
};
