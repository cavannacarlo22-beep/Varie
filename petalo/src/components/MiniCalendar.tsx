import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, fmtMonth, isSameDay, monthMatrix, toISO, weekdayNames } from '../lib/dates';

export function MiniCalendar({
  selected, onSelect, dots, monday = true,
}: {
  selected?: Date;
  onSelect: (d: Date) => void;
  dots?: Map<string, string[]>;
  monday?: boolean;
}) {
  const [cursor, setCursor] = useState(selected ?? new Date());
  const today = new Date();
  const days = monthMatrix(cursor, monday);
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <b style={{ textTransform: 'capitalize', fontFamily: 'var(--font-display)', fontWeight: 560 }}>{fmtMonth(cursor)}</b>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mese precedente"><ChevronLeft size={18} /></button>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mese successivo"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="mini-cal">
        {weekdayNames(monday, 'narrow').map((w, i) => <div key={i} className="dow">{w}</div>)}
        {days.map((d) => {
          const iso = toISO(d);
          const cls = [
            d.getMonth() !== cursor.getMonth() ? 'out' : '',
            isSameDay(d, today) ? 'today' : '',
            selected && isSameDay(d, selected) ? 'sel' : '',
          ].join(' ');
          const colors = dots?.get(iso) ?? [];
          return (
            <button key={iso} className={cls} onClick={() => onSelect(d)} aria-label={d.toLocaleDateString('it-IT')}>
              {d.getDate()}
              {colors.length > 0 && (
                <span className="ev-dots">{colors.slice(0, 3).map((c, i) => <i key={i} style={{ background: isSameDay(d, today) ? '#fff' : c }} />)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
