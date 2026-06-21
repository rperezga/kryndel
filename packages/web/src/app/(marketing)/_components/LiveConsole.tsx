'use client';

import { useEffect, useState } from 'react';

interface ConsoleRow {
  id: string;
  type: 'g' | 'a' | 'r';
  label: string;
  meta: string;
  tag: string;
  tagType: 'g' | 'a' | 'r';
  isNew?: boolean;
}

const INITIAL_ROWS: ConsoleRow[] = [
  {
    id: 'init-1',
    type: 'g',
    label: 'Transfer',
    meta: '0xe4c3…1ea67 · from 0x36e1… → 0xe4c3… · 1,250',
    tag: 'decoded',
    tagType: 'g',
  },
  {
    id: 'init-2',
    type: 'a',
    label: 'block lag',
    meta: 'indexer 1 block behind head · 6,317,492',
    tag: 'warn',
    tagType: 'a',
  },
  {
    id: 'init-3',
    type: 'r',
    label: 'Withdraw',
    meta: 'USDCVault · reverted · insufficient reserve',
    tag: 'failed',
    tagType: 'r',
  },
  {
    id: 'init-4',
    type: 'a',
    label: 'alert',
    meta: 'rule matched · Transfer > 1,000',
    tag: 'match',
    tagType: 'a',
  },
  {
    id: 'init-5',
    type: 'g',
    label: 'webhook',
    meta: 'POST /hooks/ops · 200 · 142ms · signed',
    tag: 'delivered',
    tagType: 'g',
  },
];

const SAMPLES: Omit<ConsoleRow, 'id'>[] = [
  {
    type: 'g',
    label: 'Transfer',
    meta: '0x4ba8…5392 · from 0x12a… → 0x9f3… · 820',
    tag: 'decoded',
    tagType: 'g',
  },
  {
    type: 'g',
    label: 'Swap',
    meta: 'AMM·XRP/USDC · in 500 → out 498.2',
    tag: 'decoded',
    tagType: 'g',
  },
  {
    type: 'a',
    label: 'whale',
    meta: '0x7c21… moved 75,000 tokens (~$62k)',
    tag: 'watch',
    tagType: 'a',
  },
  {
    type: 'g',
    label: 'webhook',
    meta: 'POST /hooks/ops · 200 · 118ms · signed',
    tag: 'delivered',
    tagType: 'g',
  },
  {
    type: 'r',
    label: 'Withdraw',
    meta: 'LendingPool · reverted · health factor',
    tag: 'failed',
    tagType: 'r',
  },
  {
    type: 'a',
    label: 'RegularKey',
    meta: 'issuer rXY… · SetRegularKey changed',
    tag: 'alert',
    tagType: 'a',
  },
];

export default function LiveConsole() {
  const [rows, setRows] = useState<ConsoleRow[]>(INITIAL_ROWS);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        return;
      }
    }

    let sampleIndex = 0;
    const interval = setInterval(() => {
      const sample = SAMPLES[sampleIndex % SAMPLES.length];
      sampleIndex++;

      const newRow: ConsoleRow = {
        ...sample,
        id: `row-${Date.now()}-${sampleIndex}`,
        isNew: true,
      };

      setRows((prevRows) => {
        // Keep up to 5 rows, inserting the new one at the top (beginning)
        const updated = [newRow, ...prevRows.map(r => ({ ...r, isNew: false }))];
        return updated.slice(0, 5);
      });
    }, 2600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="console" id="console" aria-label="Live contract signal example">
      <div className="cbar">
        <span className="lt">kryndel // live contract signal</span>
        <span className="live">
          <span className="dot" />
          LIVE
        </span>
      </div>
      <div className="cbody" id="cbody">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`row ${row.isNew ? 'pulse' : ''}`}
            style={{ contentVisibility: 'auto' }}
          >
            <span className={`ic ${row.type}`} />
            <span className="lbl">{row.label}</span>
            <span className="meta">{row.meta}</span>
            <span className={`tag ${row.tagType}`}>{row.tag}</span>
          </div>
        ))}
      </div>
      <div className="cfoot">
        <span>
          block <b>6,317,492</b>
        </span>
        <span>
          events/min <b>37</b>
        </span>
        <span>
          p95 <b>142ms</b>
        </span>
        <span>
          uptime <b>99.9%</b>
        </span>
      </div>
    </div>
  );
}
