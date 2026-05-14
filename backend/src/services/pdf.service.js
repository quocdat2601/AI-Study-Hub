const pdfParse = require('pdf-parse');

async function extractText(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

module.exports = { extractText };
