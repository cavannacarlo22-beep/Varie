import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import type { Extensions } from '@tiptap/core';
import { Attachment, Drawing, FontSize, LineHeight, Search, SizedImage } from './extensions';

export function buildExtensions(placeholder?: string): Extensions {
  const list: Extensions = [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    LineHeight,
    SizedImage,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Subscript,
    Superscript,
    CharacterCount,
    Attachment,
    Drawing,
    Search,
  ];
  if (placeholder) list.push(Placeholder.configure({ placeholder }));
  return list;
}
