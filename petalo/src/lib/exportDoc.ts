import { cssFamily, fontCssUrl, getFont, loadFonts } from './fonts';
import { download, sanitizeName } from './files';

export interface ExportOpts {
  title: string;
  html: string;
  fonts: Iterable<string>;
  baseFont: string;
  baseSize: number;
  lineHeight: number;
}

const PRINT_CSS = (o: ExportOpts) => `
  #print-root { font-family: ${cssFamily(o.baseFont)}; font-size: ${o.baseSize}px; line-height: ${o.lineHeight}; color: #222; }
  #print-root h1.doc-title { font-size: 2em; margin: 0 0 .6em; }
  #print-root .chapter { break-before: page; }
  #print-root .chapter:first-child { break-before: auto; }
  #print-root p { margin: 0 0 .3em; }
  #print-root img { max-width: 100%; height: auto; }
  #print-root table { border-collapse: collapse; width: 100%; }
  #print-root td, #print-root th { border: 1px solid #bbb; padding: 4px 8px; vertical-align: top; }
  #print-root blockquote { border-left: 3px solid #e7a3b5; margin: .5em 0; padding-left: 1em; font-style: italic; }
  #print-root pre { background: #f5f0f2; padding: 10px; border-radius: 6px; white-space: pre-wrap; }
  #print-root .attachment-chip { border: 1px solid #9cc7e8; border-radius: 10px; padding: 0 6px; }
  #print-root ul[data-type='taskList'] { list-style: none; padding-left: 0; }
  #print-root ul[data-type='taskList'] li { display: flex; gap: 8px; }
  #print-root mark { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 18mm 16mm; }
  @media screen { #print-root { position: fixed; left: -10000px; top: 0; width: 800px; } }
  @media print {
    body.printing > *:not(#print-root) { display: none !important; }
    body.printing { background: #fff !important; }
    #print-root { position: static; width: auto; }
  }
`;

/**
 * Prints the document using the system dialog. Choosing "Salva come PDF"
 * (or on iPad: Condividi → Salva in File) produces a PDF with the
 * Google Fonts embedded by the browser.
 */
export async function printDocument(o: ExportOpts): Promise<void> {
  await loadFonts([...o.fonts, o.baseFont]);
  document.getElementById('print-root')?.remove();
  document.getElementById('print-style')?.remove();
  const style = document.createElement('style');
  style.id = 'print-style';
  style.textContent = PRINT_CSS(o);
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'print-root';
  root.innerHTML = o.html;
  document.body.appendChild(root);
  // wait for images and fonts
  await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  try { await document.fonts.ready; } catch { /* ignore */ }
  const prevTitle = document.title;
  document.title = o.title;
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    document.title = prevTitle;
    root.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 50);
  // Safari on iPad may not fire afterprint reliably
  setTimeout(() => { if (document.body.classList.contains('printing')) cleanup(); }, 120000);
}

/**
 * Word-compatible document (.doc, HTML flavour that Word, LibreOffice and Pages open).
 * Google Fonts are linked; Word uses them if installed, otherwise a similar font.
 */
export function exportWord(o: ExportOpts): void {
  const links = [...new Set([...o.fonts, o.baseFont])].filter((f) => getFont(f)).map((f) => `<link rel="stylesheet" href="${fontCssUrl(f)}">`).join('');
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(o.title)}</title>${links}
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: ${cssFamily(o.baseFont)}; font-size: ${Math.round(o.baseSize * 0.75)}pt; line-height: ${o.lineHeight}; }
  table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 4px 8px; }
  blockquote { border-left: 3pt solid #e7a3b5; padding-left: 10pt; font-style: italic; }
  .chapter { page-break-before: always; } .chapter:first-child { page-break-before: auto; }
  img { max-width: 100%; }
</style></head><body>${o.html}</body></html>`;
  download(new Blob(['﻿', doc], { type: 'application/msword' }), sanitizeName(o.title) + '.doc');
}

export function exportHTML(o: ExportOpts): void {
  const links = [...new Set([...o.fonts, o.baseFont])].filter((f) => getFont(f)).map((f) => `<link rel="stylesheet" href="${fontCssUrl(f)}">`).join('\n');
  const doc = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(o.title)}</title>${links}
<style>body{font-family:${cssFamily(o.baseFont)};font-size:${o.baseSize}px;line-height:${o.lineHeight};max-width:820px;margin:40px auto;padding:0 20px;color:#2a2a2a}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}</style>
</head><body>${o.html}</body></html>`;
  download(new Blob([doc], { type: 'text/html' }), sanitizeName(o.title) + '.html');
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
