import { Extension, Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: { setFontSize: (size: string) => ReturnType; unsetFontSize: () => ReturnType };
    lineHeight: { setLineHeight: (v: string) => ReturnType; unsetLineHeight: () => ReturnType };
    attachment: { insertAttachment: (attrs: { fileId: string; name: string }) => ReturnType };
    drawing: { insertDrawing: (attrs: DrawingAttrs) => ReturnType };
    search: {
      setSearchTerm: (term: string, caseSensitive?: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      prevSearchResult: () => ReturnType;
      replaceCurrent: (text: string) => ReturnType;
      replaceAll: (text: string) => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
          renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (v) => ({ commands }) =>
        ['paragraph', 'heading'].map((t) => commands.updateAttributes(t, { lineHeight: v })).some(Boolean),
      unsetLineHeight: () => ({ commands }) =>
        ['paragraph', 'heading'].map((t) => commands.resetAttributes(t, 'lineHeight')).some(Boolean),
    };
  },
});

/** Image with a width attribute (percentage) so pictures can be resized. */
export const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}` } : {}),
      },
    };
  },
}).configure({ allowBase64: true, inline: false });

export const Attachment = Node.create({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      fileId: { default: null, parseHTML: (el) => el.getAttribute('data-file-id') },
      name: { default: 'allegato', parseHTML: (el) => el.getAttribute('data-name') },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-attachment]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-attachment': '', 'data-file-id': node.attrs.fileId, 'data-name': node.attrs.name, class: 'attachment-chip', contenteditable: 'false',
    }), '📎 ' + node.attrs.name];
  },
  renderText({ node }) {
    return `[allegato: ${node.attrs.name}]`;
  },
  addCommands() {
    return {
      insertAttachment: (attrs) => ({ commands }) => commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }]),
    };
  },
});

export interface DrawingAttrs { src: string; strokes: string; w: number; h: number; paper: string }

export const Drawing = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: '' },
      strokes: { default: '[]' },
      w: { default: 1000 },
      h: { default: 700 },
      paper: { default: 'blank' },
    };
  },
  parseHTML() {
    return [{
      tag: 'figure[data-drawing]',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        const img = e.querySelector('img');
        return { src: img?.getAttribute('src') ?? '', strokes: e.getAttribute('data-strokes') ?? '[]', w: Number(e.getAttribute('data-w')) || 1000, h: Number(e.getAttribute('data-h')) || 700, paper: e.getAttribute('data-paper') ?? 'blank' };
      },
    }];
  },
  renderHTML({ node }) {
    return ['figure', { 'data-drawing': '', 'data-strokes': node.attrs.strokes, 'data-w': node.attrs.w, 'data-h': node.attrs.h, 'data-paper': node.attrs.paper, class: 'drawing-block' },
      ['img', { src: node.attrs.src, alt: 'Disegno a mano', style: 'max-width:100%' }]];
  },
  renderText() {
    return '[disegno]';
  },
  addCommands() {
    return {
      insertDrawing: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
    };
  },
});

/* ——— find & replace ——— */

interface SearchState { term: string; caseSensitive: boolean; results: { from: number; to: number }[]; index: number }
export const searchKey = new PluginKey<SearchState>('search');

function findAll(doc: PMNode, term: string, cs: boolean) {
  const out: { from: number; to: number }[] = [];
  if (!term) return out;
  const needle = cs ? term : term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = cs ? node.text : node.text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ from: pos + i, to: pos + i + needle.length });
      i = hay.indexOf(needle, i + needle.length);
    }
  });
  return out;
}

export const Search = Extension.create({
  name: 'search',
  addStorage() {
    return { results: 0, index: 0 };
  },
  addCommands() {
    const scrollTo = (view: import('@tiptap/pm/view').EditorView, pos: number) => {
      requestAnimationFrame(() => {
        try {
          const dom = view.domAtPos(pos).node as HTMLElement;
          (dom.nodeType === 3 ? dom.parentElement : dom)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch { /* ignore */ }
      });
    };
    return {
      setSearchTerm: (term, caseSensitive = false) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(searchKey, { term, caseSensitive });
        return true;
      },
      nextSearchResult: () => ({ state, tr, dispatch, view }) => {
        const s = searchKey.getState(state);
        if (!s?.results.length) return false;
        const index = (s.index + 1) % s.results.length;
        if (dispatch) { tr.setMeta(searchKey, { index }); scrollTo(view, s.results[index].from); }
        return true;
      },
      prevSearchResult: () => ({ state, tr, dispatch, view }) => {
        const s = searchKey.getState(state);
        if (!s?.results.length) return false;
        const index = (s.index - 1 + s.results.length) % s.results.length;
        if (dispatch) { tr.setMeta(searchKey, { index }); scrollTo(view, s.results[index].from); }
        return true;
      },
      replaceCurrent: (text) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        const r = s?.results[s.index];
        if (!r) return false;
        if (dispatch) tr.insertText(text, r.from, r.to);
        return true;
      },
      replaceAll: (text) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s?.results.length) return false;
        if (dispatch) for (const r of [...s.results].reverse()) tr.insertText(text, r.from, r.to);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    const storage = this.storage as { results: number; index: number };
    return [new Plugin<SearchState>({
      key: searchKey,
      state: {
        init: () => ({ term: '', caseSensitive: false, results: [], index: 0 }),
        apply(tr, prev, _old, newState) {
          const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
          let next = prev;
          if (meta && ('term' in meta || 'caseSensitive' in meta)) {
            const term = meta.term ?? prev.term;
            const cs = meta.caseSensitive ?? prev.caseSensitive;
            next = { term, caseSensitive: cs, results: findAll(newState.doc, term, cs), index: 0 };
          } else if (tr.docChanged && prev.term) {
            const results = findAll(newState.doc, prev.term, prev.caseSensitive);
            next = { ...prev, results, index: Math.min(prev.index, Math.max(0, results.length - 1)) };
          }
          if (meta && typeof meta.index === 'number') next = { ...next, index: meta.index };
          storage.results = next.results.length;
          storage.index = next.index;
          return next;
        },
      },
      props: {
        decorations(state) {
          const s = searchKey.getState(state);
          if (!s?.results.length) return DecorationSet.empty;
          return DecorationSet.create(state.doc, s.results.map((r, i) => Decoration.inline(r.from, r.to, { class: 'search-hit' + (i === s.index ? ' current' : '') })));
        },
      },
    })];
  },
});
