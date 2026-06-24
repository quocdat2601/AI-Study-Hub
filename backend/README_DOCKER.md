# Backend Docker Deployment

Build the backend image from the repository root:

```bash
docker build -f backend/Dockerfile -t ai-study-hub-backend backend
```

Run with your production environment:

```bash
docker run --rm -p 5000:5000 --env-file backend/.env ai-study-hub-backend
```

The image includes Node.js, Tesseract OCR with English and Vietnamese data, LibreOffice headless, MuPDF tools, and Poppler utilities.

## Required Runtime Configuration

- Set `CORS_ORIGINS` to the deployed frontend origin, for example `https://app.example.com`.
- Set `API_PUBLIC_BASE_URL` to the public API URL used in Swagger docs.
- Set Supabase and Gemini secrets through environment variables, not baked into the image.
- Set `OLLAMA_BASE_URL` to the secure tunnel URL for the Windows Ollama host. Do not use `http://localhost:11434` from Docker unless Ollama runs in the same container or Docker network.

## SSE / Streaming

The chat streaming endpoint uses Server-Sent Events:

```text
/api/ai/documents/:id/ask/stream
```

If the API is behind a reverse proxy, disable response buffering for this route and keep long-lived HTTP connections enabled.

## Temporary Files

OCR and thumbnail rendering use `os.tmpdir()` and clean up their work directories. Keep `/tmp` writable in the container. Uploads are in-memory with a 50MB file limit, so provision enough memory for concurrent uploads and OCR jobs.

## Session Attachment Cleanup

Session-only attachments use a sliding 30-day expiry and a seven-day recovery window. Apply migration `020_session_document_cleanup.sql` before enabling cleanup.

For local development, the API schedules cleanup hourly by default. Set `SESSION_LIFECYCLE_CRON` to override the schedule or `IN_PROCESS_CLEANUP_ENABLED=false` to disable all in-process cleanup jobs.

For Render, keep `IN_PROCESS_CLEANUP_ENABLED=false` on the web service and create a Cron Job from the same Docker image:

```bash
npm run lifecycle:cleanup
```

Recommended schedule: `17 * * * *` UTC. Copy the backend Supabase and storage environment variables to the Cron Job. Before enabling writes, inspect a dry run:

```bash
npm run lifecycle:cleanup -- --dry-run
npm run lifecycle:cleanup -- --batch-size=10 --max-batches=1
```

The job is safe to overlap: database row locks, claim tokens, leases, and the storage cleanup queue prevent duplicate purges. Per-document failures remain retryable; only a job-wide failure exits nonzero.
