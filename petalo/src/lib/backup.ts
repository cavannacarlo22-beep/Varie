import JSZip from 'jszip';
import { db, DATA_TABLES, type DataTable } from '../db/db';
import type { FileRec } from '../db/types';
import { decryptBytes, encryptBytes, isEncrypted } from './crypto';

export const BACKUP_VERSION = 1;

interface Manifest {
  app: 'petalo';
  version: number;
  createdAt: number;
  counts: Record<string, number>;
}

/** Everything except file blobs, as plain JSON-serialisable data. */
export async function dumpData(): Promise<Record<DataTable, unknown[]>> {
  const out = {} as Record<DataTable, unknown[]>;
  await db.transaction('r', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      const rows = await db.table(t).toArray();
      out[t] = t === 'files' ? (rows as FileRec[]).map(({ blob: _b, ...rest }) => rest) : rows;
    }
  });
  return out;
}

export async function createBackupZip(): Promise<Blob> {
  const data = await dumpData();
  const zip = new JSZip();
  const manifest: Manifest = {
    app: 'petalo',
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', JSON.stringify(data));
  const files = zip.folder('files')!;
  for (const f of await db.files.toArray()) {
    files.file(f.id, new Uint8Array(await f.blob.arrayBuffer()), { binary: true });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function createBackup(password?: string): Promise<{ blob: Blob; name: string }> {
  const zipBlob = await createBackupZip();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  if (!password) return { blob: zipBlob, name: `petalo-backup-${stamp}.zip` };
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());
  const encrypted = await encryptBytes(bytes, password);
  return { blob: new Blob([encrypted], { type: 'application/octet-stream' }), name: `petalo-backup-${stamp}.petalo` };
}

export async function backupNeedsPassword(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return isEncrypted(head);
}

/** Replaces all data with the content of a backup. */
export async function restoreBackup(file: Blob, password?: string): Promise<Manifest> {
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (isEncrypted(bytes)) {
    if (!password) throw new Error('Questo backup è protetto da password');
    bytes = new Uint8Array(await decryptBytes(bytes, password));
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error('Il file non è un backup valido di Petalo');
  }
  const manifestFile = zip.file('manifest.json');
  const dataFile = zip.file('data.json');
  if (!manifestFile || !dataFile) throw new Error('Il file non è un backup valido di Petalo');
  const manifest = JSON.parse(await manifestFile.async('string')) as Manifest;
  if (manifest.app !== 'petalo') throw new Error('Il file non è un backup valido di Petalo');
  const data = JSON.parse(await dataFile.async('string')) as Record<string, unknown[]>;

  const fileRows: FileRec[] = [];
  for (const meta of (data.files ?? []) as Omit<FileRec, 'blob'>[]) {
    const entry = zip.file('files/' + meta.id);
    if (!entry) continue;
    const blob = new Blob([await entry.async('uint8array')], { type: meta.mime });
    fileRows.push({ ...meta, blob });
  }

  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      const rows = t === 'files' ? fileRows : (data[t] ?? []);
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
  });
  return manifest;
}

/* ——— automatic snapshots (kept inside the browser database) ——— */

const MAX_SNAPSHOTS = 10;

export async function takeSnapshot(): Promise<void> {
  const data = JSON.stringify(await dumpData());
  await db.snapshots.add({ createdAt: Date.now(), size: data.length, data });
  const all = await db.snapshots.orderBy('createdAt').primaryKeys();
  if (all.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(all.slice(0, all.length - MAX_SNAPSHOTS));
}

/** Restores a snapshot. Files (blobs) are kept: snapshots only hold metadata. */
export async function restoreSnapshot(id: number): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Copia non trovata');
  const data = JSON.parse(snap.data) as Record<string, unknown[]>;
  const blobs = new Map((await db.files.toArray()).map((f) => [f.id, f.blob]));
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      let rows = data[t] ?? [];
      if (t === 'files') {
        rows = (rows as Omit<FileRec, 'blob'>[]).filter((f) => blobs.has(f.id)).map((f) => ({ ...f, blob: blobs.get(f.id)! }));
      }
      await db.table(t).clear();
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
  });
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
