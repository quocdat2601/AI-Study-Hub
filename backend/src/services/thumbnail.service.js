const childProcess = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function execFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, { timeout: 30000, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.message = stderr?.trim() || stdout?.trim() || error.message;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function getPdfToPpmPath() {
  return process.env.PDFTOPPM_PATH || 'pdftoppm';
}

function getLibreOfficePath() {
  return process.env.LIBREOFFICE_PATH || 'soffice';
}

function getMuToolPath() {
  return process.env.MUTOOL_PATH || 'mutool';
}

async function renderPdfFirstPage(pdfPath, outputPrefix) {
  try {
    await execFile(getPdfToPpmPath(), [
      '-png',
      '-singlefile',
      '-f',
      '1',
      '-l',
      '1',
      '-scale-to',
      '900',
      pdfPath,
      outputPrefix,
    ]);

    return `${outputPrefix}.png`;
  } catch (_popplerError) {
    const outputPath = `${outputPrefix}.png`;
    await execFile(getMuToolPath(), [
      'draw',
      '-o',
      outputPath,
      '-r',
      '144',
      pdfPath,
      '1',
    ]);

    return outputPath;
  }
}

async function convertDocxToPdf(docxPath, outputDir) {
  await execFile(getLibreOfficePath(), [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    outputDir,
    docxPath,
  ]);

  const pdfPath = path.join(outputDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
  await fs.access(pdfPath);
  return pdfPath;
}

async function generateThumbnailFromBuffer(buffer, mimeType) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-study-thumbnail-'));

  try {
    const extension = mimeType === DOCX_MIME ? '.docx' : '.pdf';
    const sourcePath = path.join(workDir, `source${extension}`);
    const outputPrefix = path.join(workDir, 'thumbnail');
    await fs.writeFile(sourcePath, buffer);

    let pdfPath = sourcePath;
    if (mimeType === DOCX_MIME) {
      pdfPath = await convertDocxToPdf(sourcePath, workDir);
    } else if (mimeType !== PDF_MIME) {
      throw new Error('Only PDF and DOCX thumbnails are supported');
    }

    const thumbnailPath = await renderPdfFirstPage(pdfPath, outputPrefix);
    return fs.readFile(thumbnailPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function createThumbnailStoragePath({ userId, documentId, fileId }) {
  if (fileId) return `thumbnails/files/${fileId}.png`;
  return `thumbnails/user-${userId}/${documentId}.png`;
}

module.exports = {
  generateThumbnailFromBuffer,
  createThumbnailStoragePath,
};
