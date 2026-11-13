import type { FileCategory } from '../db/types';

export function categorize(name: string, mime: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'ods', 'csv', 'numbers'].includes(ext)) return 'excel';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'presentazione';
  if (mime.startsWith('image/') || ['heic', 'heif', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'immagine';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archivio';
  if (mime.startsWith('text/') || ['txt', 'md'].includes(ext)) return 'testo';
  return 'altro';
}

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  pdf: 'PDF', word: 'Word', excel: 'Excel', immagine: 'Immagini', presentazione: 'Presentazioni',
  testo: 'Testo', audio: 'Audio', video: 'Video', archivio: 'Archivi', altro: 'Altro',
};

export const CATEGORY_COLOR: Record<FileCategory, string> = {
  pdf: '#e46f8e', word: '#5f9fd8', excel: '#4caf84', immagine: '#b49be0', presentazione: '#f2a35e',
  testo: '#9a8a90', audio: '#e88aa3', video: '#7fb5e0', archivio: '#c4a77d', altro: '#a8868f',
};

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} GB`;
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

export function pickFiles(accept = '', multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    };
    input.click();
  });
}

export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downscales an image so notes stay light and fast. */
export async function compressImage(file: Blob, maxSide = 1800, quality = 0.86): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl;
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    return dataUrl;
  }
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.size < 600 * 1024) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const isPng = file.type === 'image/png';
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
}

export async function dataURLToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export function sanitizeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'documento';
}
