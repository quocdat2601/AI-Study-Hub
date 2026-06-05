# Thumbnail Tool Setup

AI Study Hub generates document thumbnails from uploaded PDFs/DOCX files.

Each backend developer needs these local tools installed:

- LibreOffice: converts DOCX to PDF.
- MuPDF: renders PDF pages to PNG thumbnails.
- Poppler: optional first-choice PDF renderer. On some Windows installs it may not expose `pdftoppm.exe`, so the backend can fall back to MuPDF.

## Windows Install

Open **PowerShell as Administrator**, then run:

```powershell
choco install poppler libreoffice-fresh mupdf -y
```

If Chocolatey is not installed yet, install it first from:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

Then close and reopen your terminal.

## Backend `.env`

Add these lines to `backend/.env`:

```env
MUTOOL_PATH=C:/ProgramData/chocolatey/bin/mutool.exe
LIBREOFFICE_PATH=C:/Program Files/LibreOffice/program/soffice.exe
```

Optional, only if your Poppler install has `pdftoppm.exe`:

```env
PDFTOPPM_PATH=C:/path/to/pdftoppm.exe
```

## Verify Install

Run this in PowerShell:

```powershell
where.exe mutool
where.exe soffice
```

Expected examples:

```text
C:\ProgramData\chocolatey\bin\mutool.exe
C:\Program Files\LibreOffice\program\soffice.exe
```

## Notes

- If these tools are missing, uploads still work, but `thumbnail_status` becomes `failed`.
- Seeded demo documents use the same thumbnail pipeline as real uploads.
- After changing `.env`, restart the backend dev server.
