const childProcess = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const IMAGE_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/tiff': '.tiff',
  'image/bmp': '.bmp',
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_PDF_PAGES = 1000;
const DEFAULT_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT_JOBS = 1;
const DEFAULT_OCR_LANG = 'eng+vie';

let activeJobs = 0;
const queue = [];

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig() {
  return {
    tesseractPath: process.env.TESSERACT_PATH || 'tesseract',
    mutoolPath: process.env.MUTOOL_PATH || 'mutool',
    ocrLang: process.env.OCR_LANG || DEFAULT_OCR_LANG,
    timeoutMs: parsePositiveInt(process.env.OCR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxPdfPages: parsePositiveInt(process.env.OCR_MAX_PDF_PAGES, DEFAULT_MAX_PDF_PAGES),
    maxImageBytes: parsePositiveInt(process.env.OCR_MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES),
    maxConcurrentJobs: parsePositiveInt(
      process.env.OCR_MAX_CONCURRENT_JOBS,
      DEFAULT_MAX_CONCURRENT_JOBS
    ),
  };
}

function runLimited(task) {
  const { maxConcurrentJobs } = getConfig();

  return new Promise((resolve, reject) => {
    const run = async () => {
      activeJobs += 1;
      try {
        resolve(await task());
      } catch (err) {
        reject(err);
      } finally {
        activeJobs -= 1;
        const next = queue.shift();
        if (next) next();
      }
    };

    if (activeJobs < maxConcurrentJobs) {
      run();
    } else {
      queue.push(run);
    }
  });
}

function execFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || getConfig().timeoutMs;
    childProcess.execFile(command, args, { ...options, timeout }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr?.trim() || stdout?.trim() || error.message;
        error.message = detail;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function createOcrError(message, code, metadata = {}) {
  const error = new Error(message);
  error.code = code;
  error.ocrMetadata = metadata;
  return error;
}

function normalizeToolError(err, toolName) {
  if (err.code === 'ENOENT') {
    return createOcrError(`${toolName} is not installed or is not on PATH`, `${toolName}_missing`, {
      ...buildBaseMetadata({ ocrConfidence: null }),
      missingTool: toolName,
    });
  }

  if (err.killed || err.signal === 'SIGTERM') {
    return createOcrError(`${toolName} timed out during OCR processing`, `${toolName}_timeout`, {
      ...buildBaseMetadata({ ocrConfidence: null }),
      timeout: true,
    });
  }

  err.ocrMetadata = err.ocrMetadata || {};
  return err;
}

function parseTsv(tsv) {
  const lines = String(tsv || '').split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return { text: '', confidence: null };
  }

  const header = lines[0].split('\t');
  const textIndex = header.indexOf('text');
  const confIndex = header.indexOf('conf');
  const words = [];
  const confidences = [];

  for (const line of lines.slice(1)) {
    const columns = line.split('\t');
    const word = textIndex >= 0 ? String(columns[textIndex] || '').trim() : '';
    const confidence = confIndex >= 0 ? Number(columns[confIndex]) : NaN;

    if (word) {
      words.push(word);
    }
    if (Number.isFinite(confidence) && confidence >= 0) {
      confidences.push(confidence);
    }
  }

  const confidence = confidences.length
    ? Math.round(confidences.reduce((total, value) => total + value, 0) / confidences.length)
    : null;

  return {
    text: words.join(' '),
    confidence,
  };
}

function buildPageTextMetadata(pageResults) {
  const boundaries = [];
  const texts = [];
  let offset = 0;

  for (const result of pageResults) {
    const text = String(result.text || '').trim();
    if (!text) continue;
    if (texts.length) offset += 2;
    const startChar = offset;
    texts.push(text);
    offset += text.length;
    boundaries.push({
      pageNumber: result.page,
      startChar,
      endChar: offset,
    });
  }

  return {
    text: texts.join('\n\n'),
    pageBoundaries: boundaries,
  };
}

async function runTesseract(imagePath) {
  const { tesseractPath, ocrLang, timeoutMs } = getConfig();

  try {
    const { stdout } = await execFile(tesseractPath, [
      imagePath,
      'stdout',
      '-l',
      ocrLang,
      'tsv',
    ], { timeout: timeoutMs });

    return parseTsv(stdout);
  } catch (err) {
    throw normalizeToolError(err, 'tesseract');
  }
}

async function writeSourceFile(workDir, buffer, extension) {
  const sourcePath = path.join(workDir, `source${extension}`);
  await fs.writeFile(sourcePath, buffer);
  return sourcePath;
}

async function renderPdfPages(pdfPath, workDir) {
  const { mutoolPath, maxPdfPages, timeoutMs } = getConfig();
  const outputPattern = path.join(workDir, 'page-%03d.png');

  try {
    await execFile(mutoolPath, [
      'draw',
      '-o',
      outputPattern,
      '-r',
      '200',
      pdfPath,
      `1-${maxPdfPages}`,
    ], { timeout: timeoutMs });
  } catch (err) {
    throw normalizeToolError(err, 'mutool');
  }

  const entries = await fs.readdir(workDir);
  return entries
    .filter((entry) => /^page-\d+\.png$/.test(entry))
    .sort()
    .map((entry) => path.join(workDir, entry));
}

function buildBaseMetadata(extra = {}) {
  const { ocrLang } = getConfig();
  return {
    ocrProvider: 'tesseract-cli',
    ocrLang,
    ...extra,
  };
}

async function extractImageText(buffer, mimeType) {
  const { maxImageBytes } = getConfig();
  if (Buffer.byteLength(buffer) > maxImageBytes) {
    throw createOcrError(
      `Image is too large for OCR. Maximum is ${Math.round(maxImageBytes / 1024 / 1024)}MB`,
      'ocr_image_too_large',
      buildBaseMetadata({ maxImageBytes })
    );
  }

  const extension = IMAGE_EXTENSIONS[mimeType] || '.img';
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-study-ocr-'));

  try {
    const sourcePath = await writeSourceFile(workDir, buffer, extension);
    const result = await runLimited(() => runTesseract(sourcePath));

    return {
      text: result.text,
      metadata: buildBaseMetadata({
        ocrConfidence: result.confidence,
        ocrPages: {
          attempted: 1,
          succeeded: result.text ? 1 : 0,
          failed: 0,
          max: 1,
        },
        pageBoundaries: result.text
          ? [{ pageNumber: 1, startChar: 0, endChar: result.text.length }]
          : [],
      }),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function extractPdfText(buffer) {
  const { maxPdfPages } = getConfig();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-study-ocr-pdf-'));

  try {
    const sourcePath = await writeSourceFile(workDir, buffer, '.pdf');
    const pagePaths = await renderPdfPages(sourcePath, workDir);
    const pageResults = [];
    const pageErrors = [];

    for (const pagePath of pagePaths) {
      const pageNumber = pageResults.length + pageErrors.length + 1;
      try {
        const result = await runLimited(() => runTesseract(pagePath));
        pageResults.push({ page: pageNumber, ...result });
      } catch (err) {
        pageErrors.push({
          page: pageNumber,
          error: err.message,
          code: err.code || 'ocr_page_failed',
        });
      }
    }

    if (!pageResults.length && pageErrors.length) {
      const firstError = pageErrors[0];
      throw createOcrError(firstError.error, firstError.code, buildBaseMetadata({
        ocrPages: {
          attempted: pageErrors.length,
          succeeded: 0,
          failed: pageErrors.length,
          max: maxPdfPages,
          errors: pageErrors,
        },
      }));
    }

    const confidences = pageResults
      .map((result) => result.confidence)
      .filter((confidence) => Number.isFinite(confidence));

    const pageText = buildPageTextMetadata(pageResults);
    return {
      text: pageText.text,
      metadata: buildBaseMetadata({
        ocrConfidence: confidences.length
          ? Math.round(confidences.reduce((total, value) => total + value, 0) / confidences.length)
          : null,
        ocrPages: {
          attempted: pageResults.length + pageErrors.length,
          succeeded: pageResults.length,
          failed: pageErrors.length,
          max: maxPdfPages,
          errors: pageErrors,
        },
        pageBoundaries: pageText.pageBoundaries,
      }),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

module.exports = {
  extractImageText,
  extractPdfText,
  IMAGE_EXTENSIONS,
};
