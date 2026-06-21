FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=5000 \
    TESSERACT_PATH=tesseract \
    MUTOOL_PATH=mutool \
    PDFTOPPM_PATH=pdftoppm \
    LIBREOFFICE_PATH=soffice \
    OCR_LANG=eng+vie \
    TMPDIR=/tmp \
    HOME=/tmp

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      fonts-dejavu \
      fonts-liberation \
      libreoffice \
      mupdf-tools \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-vie \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app /tmp

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1

CMD ["npm", "start"]
