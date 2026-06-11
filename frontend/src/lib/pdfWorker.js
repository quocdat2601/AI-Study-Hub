import { pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * Worker phải cùng phiên bản với pdfjs API (5.4.296).
 * Dùng ?url để Vite bundle đúng file worker — tránh lỗi version mismatch.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjs };
