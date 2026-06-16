# OCR deployment notes

AI Study Hub uses native Tesseract OCR for image uploads and scanned PDF fallback.
PDF pages are rasterized with MuPDF's `mutool`, then passed to Tesseract.

## Required system packages

Install these in production images or hosts:

```bash
apt-get update
apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-vie mupdf-tools
```

For Windows development, install Tesseract OCR and MuPDF tools, then either add both
executables to `PATH` or configure their absolute paths with environment variables.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TESSERACT_PATH` | `tesseract` | Tesseract executable path |
| `MUTOOL_PATH` | `mutool` | MuPDF executable path |
| `OCR_LANG` | `eng+vie` | OCR language packs |
| `OCR_TIMEOUT_MS` | `30000` | Per-command timeout |
| `OCR_MAX_PDF_PAGES` | `10` | Maximum pages OCR attempts per PDF |
| `OCR_MAX_IMAGE_BYTES` | `15728640` | Maximum image bytes for OCR |
| `OCR_MAX_CONCURRENT_JOBS` | `1` | In-process OCR concurrency limit |

If Tesseract or `mutool` is missing, extraction records a graceful `empty` status
with `extraction_error` and `extraction_metadata` instead of crashing the server.
