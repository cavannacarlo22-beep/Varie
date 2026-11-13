import type { PDFDocumentProxy } from 'pdfjs-dist';

let lib: typeof import('pdfjs-dist') | null = null;

async function pdfjs() {
  if (lib) return lib;
  const mod = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  mod.GlobalWorkerOptions.workerSrc = worker;
  lib = mod;
  return mod;
}

export async function openPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  return lib.getDocument({ data }).promise;
}

/** Renders one page to a canvas. `width` is the CSS width wanted. */
export async function renderPage(doc: PDFDocumentProxy, n: number, width: number): Promise<{ canvas: HTMLCanvasElement; w: number; h: number }> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = (width / base.width) * dpr;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return { canvas, w: base.width, h: base.height };
}

/** Stamps transparent PNG overlays (one per page, or null) onto a copy of the PDF. */
export async function stampPdf(original: Blob, overlays: (string | null)[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(await original.arrayBuffer(), { ignoreEncryption: true });
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const ov = overlays[i];
    if (!ov) continue;
    const png = await pdf.embedPng(ov);
    const page = pages[i];
    const { width, height } = page.getSize();
    page.drawImage(png, { x: 0, y: 0, width, height });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
