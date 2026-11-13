import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileQuestion, PenLine, Save } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { db, uid } from '../db/db';
import type { FileRec } from '../db/types';
import { download, fmtSize, openBlob } from '../lib/files';
import { openPdf, renderPage, stampPdf } from '../lib/pdf';
import { DrawingCanvas, DrawToolbar, type DrawingHandle, type Tool } from './DrawingCanvas';
import { Modal, useUI } from './ui';
import { useSettings } from '../db/settings';

export function FileViewer({ file, onClose }: { file: FileRec; onClose: () => void }) {
  const [annotate, setAnnotate] = useState(false);
  const canAnnotate = file.category === 'pdf' || (file.category === 'immagine' && !/svg|heic|heif/i.test(file.mime + file.name));
  return (
    <Modal title={file.name} size="full" onClose={onClose}>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <span className="small muted grow">{fmtSize(file.size)} · {new Date(file.createdAt).toLocaleDateString('it-IT')}</span>
        {canAnnotate && <button className={'btn btn-sm ' + (annotate ? 'btn-primary' : 'btn-soft')} onClick={() => setAnnotate(!annotate)}><PenLine size={16} />{annotate ? 'Chiudi annotazioni' : 'Annota / scrivi a mano'}</button>}
        <button className="btn btn-sm" onClick={() => openBlob(file.blob)}><ExternalLink size={16} />Apri</button>
        <button className="btn btn-sm" onClick={() => download(file.blob, file.name)}><Download size={16} />Scarica</button>
      </div>
      {annotate ? (
        file.category === 'pdf' ? <PdfAnnotator file={file} onDone={onClose} /> : <ImageAnnotator file={file} onDone={onClose} />
      ) : (
        <Preview file={file} />
      )}
    </Modal>
  );
}

function Preview({ file }: { file: FileRec }) {
  if (file.category === 'immagine') return <ImagePreview blob={file.blob} />;
  if (file.category === 'pdf') return <PdfPreview blob={file.blob} />;
  if (/\.docx$/i.test(file.name)) return <DocxPreview blob={file.blob} />;
  if (file.category === 'testo' || /\.csv$/i.test(file.name)) return <TextPreview blob={file.blob} />;
  if (file.category === 'audio') return <MediaPreview blob={file.blob} kind="audio" />;
  if (file.category === 'video') return <MediaPreview blob={file.blob} kind="video" />;
  return (
    <div className="viewer-body" style={{ justifyContent: 'center' }}>
      <FileQuestion size={56} color="var(--muted)" />
      <p className="muted" style={{ textAlign: 'center', maxWidth: 420 }}>
        L’anteprima di questo formato non è disponibile nel browser. Tocca <b>Apri</b> per aprirlo con l’app adatta (Word, Excel, Pages, Numbers…) oppure <b>Scarica</b>.
      </p>
    </div>
  );
}

function useObjectUrl(blob: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function ImagePreview({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob);
  return <div className="viewer-body" style={{ justifyContent: 'center' }}>{url && <img src={url} alt="" />}</div>;
}
function MediaPreview({ blob, kind }: { blob: Blob; kind: 'audio' | 'video' }) {
  const url = useObjectUrl(blob);
  return <div className="viewer-body" style={{ justifyContent: 'center' }}>{url && (kind === 'audio' ? <audio src={url} controls /> : <video src={url} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />)}</div>;
}
function TextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState('');
  useEffect(() => { void blob.text().then(setText); }, [blob]);
  return <div className="viewer-body"><pre style={{ whiteSpace: 'pre-wrap', background: 'var(--surface)', padding: 20, borderRadius: 12, width: '100%', margin: 0 }}>{text}</pre></div>;
}
function DocxPreview({ blob }: { blob: Blob }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const mammoth = await import('mammoth');
        const res = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setHtml(res.value);
      } catch {
        setErr(true);
      }
    })();
  }, [blob]);
  if (err) return <div className="viewer-body"><p className="muted">Non riesco a leggere questo documento. Prova con “Apri”.</p></div>;
  return (
    <div className="viewer-body">
      {html === null ? <p className="muted">Apro il documento…</p> : <div className="docx-preview" dangerouslySetInnerHTML={{ __html: sanitize(html) }} />}
    </div>
  );
}
/** mammoth output is already restricted HTML; strip anything scriptable just in case. */
function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, style').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) if (a.name.startsWith('on') || /javascript:/i.test(a.value)) el.removeAttribute(a.name);
  });
  return doc.body.innerHTML;
}

function PdfPreview({ blob }: { blob: Blob }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [err, setErr] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    let d: PDFDocumentProxy | null = null;
    openPdf(blob).then((x) => { d = x; setDoc(x); }).catch(() => setErr('Impossibile aprire il PDF (potrebbe essere protetto da password).'));
    return () => { void d?.destroy(); };
  }, [blob]);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(1000, el.clientWidth - 24)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="viewer-body" ref={bodyRef}>
      {err && <p className="muted">{err}</p>}
      {!doc && !err && <p className="muted">Apro il PDF…</p>}
      {doc && Array.from({ length: doc.numPages }, (_, i) => <LazyPdfPage key={i} doc={doc} n={i + 1} width={width} />)}
    </div>
  );
}

function LazyPdfPage({ doc, n, width }: { doc: PDFDocumentProxy; n: number; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(n <= 2);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible || !ref.current) return;
    let alive = true;
    renderPage(doc, n, width).then(({ canvas, w, h }) => {
      if (!alive || !ref.current) return;
      setRatio(h / w);
      canvas.style.width = width + 'px';
      ref.current.replaceChildren(canvas);
    }).catch(() => {});
    return () => { alive = false; };
  }, [visible, doc, n, width]);
  return <div ref={ref} className="pdf-page" style={{ width, minHeight: width * ratio }} />;
}

/* ——— annotation ——— */

async function saveAnnotated(file: FileRec, blob: Blob, ext: string, mode: 'copy' | 'replace') {
  const now = Date.now();
  if (mode === 'replace') {
    await db.files.update(file.id, { blob, size: blob.size, updatedAt: now, mime: blob.type });
    return;
  }
  const base = file.name.replace(/\.[^.]+$/, '');
  await db.files.add({ ...file, id: uid(), name: `${base} (annotato).${ext}`, blob, size: blob.size, mime: blob.type, createdAt: now, updatedAt: now });
}

function SaveButtons({ onSave }: { onSave: (mode: 'copy' | 'replace') => void }) {
  return (
    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
      <button className="btn" onClick={() => onSave('replace')}><Save size={16} />Sovrascrivi originale</button>
      <button className="btn btn-primary" onClick={() => onSave('copy')}><Save size={16} />Salva come copia</button>
    </div>
  );
}

function ImageAnnotator({ file, onDone }: { file: FileRec; onDone: () => void }) {
  const ui = useUI();
  const url = useObjectUrl(file.blob);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const ref = useRef<DrawingHandle>(null);
  useEffect(() => {
    if (!url) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  const save = async (mode: 'copy' | 'replace') => {
    if (!ref.current || !img) return;
    const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const dataUrl = ref.current.toDataURL(true, (img.naturalWidth * scale) / Math.min(img.naturalWidth, 1400));
    const blob = await (await fetch(dataUrl)).blob();
    await saveAnnotated(file, blob, 'png', mode);
    ui.toast('Annotazioni salvate');
    onDone();
  };
  if (!img) return <p className="muted">Carico l’immagine…</p>;
  const w = Math.min(img.naturalWidth, 1400);
  const h = (img.naturalHeight / img.naturalWidth) * w;
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <DrawingCanvas ref={ref} width={w} height={h} background={img} />
      <SaveButtons onSave={save} />
    </div>
  );
}

function PdfAnnotator({ file, onDone }: { file: FileRec; onDone: () => void }) {
  const ui = useUI();
  const settings = useSettings();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<{ canvas: HTMLCanvasElement; w: number; h: number }[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#e46f8e');
  const [size, setSize] = useState(3);
  const [saving, setSaving] = useState(false);
  const handles = useRef<(DrawingHandle | null)[]>([]);
  const MAX = 60;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await openPdf(file.blob);
        if (!alive) return;
        setDoc(d);
        const out = [];
        for (let i = 1; i <= Math.min(d.numPages, MAX); i++) {
          out.push(await renderPage(d, i, 900));
          if (!alive) return;
          setPages([...out]);
        }
      } catch {
        ui.toast('Impossibile aprire il PDF', true);
      }
    })();
    return () => { alive = false; };
  }, [file.blob, ui]);

  const save = async (mode: 'copy' | 'replace') => {
    setSaving(true);
    try {
      const overlays = pages.map((_p, i) => {
        const h = handles.current[i];
        if (!h || h.isEmpty()) return null;
        return h.toDataURL(false, 2);
      });
      if (overlays.every((o) => !o)) { ui.toast('Non hai ancora scritto nulla'); setSaving(false); return; }
      const blob = await stampPdf(file.blob, overlays);
      await saveAnnotated(file, blob, 'pdf', mode);
      ui.toast('PDF annotato salvato');
      onDone();
    } catch (e) {
      console.error(e);
      ui.toast('Salvataggio non riuscito: il PDF potrebbe essere protetto', true);
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize} pencilOnly={settings.pencilOnly} />
      <div className="viewer-body" style={{ touchAction: settings.pencilOnly ? 'auto' : 'pan-y' }}>
        {!doc && <p className="muted">Apro il PDF…</p>}
        {doc && doc.numPages > MAX && <p className="small muted">Si possono annotare le prime {MAX} pagine.</p>}
        {pages.map((p, i) => (
          <div key={i} style={{ width: '100%', maxWidth: 900 }}>
            <div className="row between tiny muted" style={{ marginBottom: 4 }}>
              <span>Pagina {i + 1}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => handles.current[i]?.undo()}>Annulla tratto</button>
            </div>
            <div style={{ width: '100%', aspectRatio: `${p.w} / ${p.h}`, display: 'flex' }}>
              <DrawingCanvas ref={(h) => { handles.current[i] = h; }} width={p.w} height={p.h} background={p.canvas} toolbar={false} tool={{ tool, color, size }} fit="width" />
            </div>
          </div>
        ))}
      </div>
      <SaveButtons onSave={(m) => !saving && save(m)} />
    </div>
  );
}
