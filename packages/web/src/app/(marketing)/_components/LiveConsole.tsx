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
  timestamp: string;
}

const INITIAL_ROWS: ConsoleRow[] = [
  {
    id: 'init-1',
    type: 'g',
    label: 'Transfer',
    meta: '0xe4c3…1ea67 · from 0x36e1… → 0xe4c3… · 1,250',
    tag: 'decoded',
    tagType: 'g',
    timestamp: '22:41:07',
  },
  {
    id: 'init-2',
    type: 'a',
    label: 'block lag',
    meta: 'indexer 1 block behind head · 6,317,492',
    tag: 'warn',
    tagType: 'a',
    timestamp: '22:41:09',
  },
  {
    id: 'init-3',
    type: 'r',
    label: 'Withdraw',
    meta: 'USDCVault · reverted · insufficient reserve',
    tag: 'failed',
    tagType: 'r',
    timestamp: '22:41:11',
  },
  {
    id: 'init-4',
    type: 'a',
    label: 'alert',
    meta: 'rule matched · Transfer > 1,000',
    tag: 'match',
    tagType: 'a',
    timestamp: '22:41:13',
  },
  {
    id: 'init-5',
    type: 'g',
    label: 'webhook',
    meta: 'POST /hooks/ops · 200 · 142ms · signed',
    tag: 'delivered',
    tagType: 'g',
    timestamp: '22:41:15',
  },
];

const SAMPLES: Omit<ConsoleRow, 'id' | 'timestamp'>[] = [
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

function formatTime(d: Date): string {
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

function formatMeta(meta: string) {
  const parts = meta.split(' · ');
  return parts.map((part, idx) => {
    let content: React.ReactNode = part;
    if (part.includes('from') || part.includes('→')) {
      const subParts = part.split(' ');
      content = subParts.map((sub, sIdx) => {
        if (sub === 'from') {
          return <span key={sIdx} className="dim">from </span>;
        }
        if (sub === '→' || sub === '->') {
          return <span key={sIdx} className="dim">&rarr; </span>;
        }
        return sub + ' ';
      });
    } else if (/^\d[\d,]*$/.test(part)) {
      content = <span className="dim">{part}</span>;
    } else if (part === 'insufficient reserve' || part === 'health factor' || part === 'signed') {
      content = <span className="dim">{part}</span>;
    } else if (part.startsWith('Transfer >') || part.startsWith('SetRegularKey changed')) {
      content = <span className="dim">{part}</span>;
    }
    return (
      <span key={idx}>
        {idx > 0 && ' · '}
        {content}
      </span>
    );
  });
}

export default function LiveConsole() {
  const [rows, setRows] = useState<ConsoleRow[]>(INITIAL_ROWS);

  useEffect(() => {
    let sampleIndex = 0;
    const interval = setInterval(() => {
      const sample = SAMPLES[sampleIndex % SAMPLES.length];
      sampleIndex++;

      const newRow: ConsoleRow = {
        ...sample,
        id: `row-${Date.now()}-${sampleIndex}`,
        isNew: true,
        timestamp: formatTime(new Date()),
      };

      setRows((prevRows) => {
        const updated = [newRow, ...prevRows.map(r => ({ ...r, isNew: false }))];
        return updated.slice(0, 5);
      });
    }, 2600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="term-console-root" id="console" aria-label="Live contract signal example">
      <style dangerouslySetInnerHTML={{ __html: `
        .term-console-root {
          width: 100%;
          max-width: 660px;
          background: var(--ds-panel);
          border: 1px solid var(--ds-border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 30px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(43,217,111,.05), inset 0 1px 0 rgba(255,255,255,.02);
          font-family: var(--font-jetbrains, 'JetBrains Mono', ui-monospace, monospace);
          text-align: left;
          box-sizing: border-box;
        }

        .term-console-root .bar {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 11px 14px;
          background: var(--ds-panel-2);
          border-bottom: 1px solid var(--ds-border);
          box-sizing: border-box;
        }

        .term-console-root .dots {
          display: flex;
          gap: 7px;
        }

        .term-console-root .dots i {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          display: block;
        }

        .term-console-root .dots i:nth-child(1) { background: #ff5f57; }
        .term-console-root .dots i:nth-child(2) { background: #febc2e; }
        .term-console-root .dots i:nth-child(3) { background: #28c840; }

        .term-console-root .ttl {
          font-size: 12.5px;
          color: var(--ds-text-2);
          font-weight: 500;
        }

        .term-console-root .ttl b {
          color: var(--ds-green);
          font-weight: 600;
        }

        .term-console-root .live {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          color: var(--ds-green);
          font-weight: 600;
          letter-spacing: .5px;
        }

        .term-console-root .live .pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ds-green);
          box-shadow: 0 0 8px var(--ds-green);
          animation: term-blink 1.5s infinite;
        }

        @keyframes term-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: .3; }
        }

        .term-console-root .body {
          padding: 14px 10px 10px;
          font-size: 12.5px;
          line-height: 1;
          min-height: 268px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .term-console-root .row {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 7px 8px;
          border-radius: 7px;
          border: 1px solid transparent;
          white-space: nowrap;
          box-sizing: border-box;
        }

        .term-console-root .row .ts {
          color: var(--ds-text-3);
          width: 74px;
          flex-shrink: 0;
        }

        .term-console-root .row .g {
          width: 18px;
          flex-shrink: 0;
          text-align: center;
          font-weight: 700;
        }

        .term-console-root .row .lbl {
          width: 96px;
          flex-shrink: 0;
          color: var(--ds-text);
          font-weight: 500;
        }

        .term-console-root .row .meta {
          flex: 1;
          color: var(--ds-text-2);
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          text-align: left;
        }

        .term-console-root .row .meta .dim {
          color: var(--ds-text-3);
        }

        .term-console-root .row .tag {
          flex-shrink: 0;
          font-size: 10.5px;
          padding: 2px 8px;
          border-radius: 5px;
          margin-left: 10px;
          letter-spacing: .3px;
        }

        .term-console-root .g.green { color: var(--ds-green); }
        .term-console-root .g.amber { color: var(--ds-amber); }
        .term-console-root .g.red { color: var(--ds-red); }

        .term-console-root .tag.green {
          background: rgba(43, 217, 111, .12);
          color: var(--ds-green);
        }

        .term-console-root .tag.amber {
          background: rgba(255, 176, 32, .12);
          color: var(--ds-amber);
        }

        .term-console-root .tag.red {
          background: rgba(255, 77, 79, .12);
          color: var(--ds-red);
        }

        .term-console-root .row.new {
          animation: term-phos 2.2s ease-out;
        }

        @keyframes term-phos {
          0% {
            border-color: var(--ds-border-on);
            background: rgba(43, 217, 111, .07);
          }
          100% {
            border-color: transparent;
            background: transparent;
          }
        }

        .term-console-root .cursor {
          padding: 7px 8px;
          color: var(--ds-green);
          text-align: left;
        }

        .term-console-root .cursor b {
          display: inline-block;
          width: 8px;
          height: 15px;
          background: var(--ds-green);
          vertical-align: -2px;
          margin-left: 4px;
          animation: term-cur 1.1s step-end infinite;
        }

        @keyframes term-cur {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .term-console-root .foot {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 9px 14px;
          background: var(--ds-panel-2);
          border-top: 1px solid var(--ds-border);
          font-size: 11px;
          color: var(--ds-text-3);
          box-sizing: border-box;
        }

        .term-console-root .foot .seg {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 14px;
          border-right: 1px solid var(--ds-border);
        }

        .term-console-root .foot .seg:first-child {
          padding-left: 0;
        }

        .term-console-root .foot .seg:last-child {
          border-right: 0;
        }

        .term-console-root .foot .seg b {
          color: var(--ds-text);
          font-weight: 600;
        }

        .term-console-root .foot .seg .ok {
          color: var(--ds-green);
        }

        @media (prefers-reduced-motion: reduce) {
          .term-console-root *,
          .term-console-root *::before,
          .term-console-root *::after {
            animation: none !important;
            transition: none !important;
          }
          .term-console-root .row.new {
            animation: none !important;
          }
        }

        @media (max-width: 560px) {
          .term-console-root .row .lbl {
            width: 74px;
          }
          .term-console-root .row .ts {
            width: 62px;
          }
          .term-console-root .foot {
            flex-wrap: wrap;
            gap: 6px 0;
          }
          .term-console-root .foot .seg {
            padding: 0 10px;
          }
        }
      ` }} />
      <div className="bar">
        <div className="dots"><i /><i /><i /></div>
        <span className="ttl"><b>kryndel</b>@mainnet — live-signal</span>
        <span className="live"><span className="pulse"></span>LIVE</span>
      </div>
      <div className="body" id="body">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`row ${row.isNew ? 'new' : ''}`}
            style={{ contentVisibility: 'auto' }}
          >
            <span className="ts">{row.timestamp}</span>
            <span className={`g ${row.type === 'g' ? 'green' : row.type === 'a' ? 'amber' : 'red'}`}>
              {row.type === 'g' ? '●' : row.type === 'a' ? '▲' : '✕'}
            </span>
            <span className="lbl">{row.label}</span>
            <span className="meta">{formatMeta(row.meta)}</span>
            <span className={`tag ${row.tagType === 'g' ? 'green' : row.tagType === 'a' ? 'amber' : 'red'}`}>
              {row.tag}
            </span>
          </div>
        ))}
        <div className="cursor">
          kryndel<span style={{ color: 'var(--ds-text-3)' }}>@mainnet</span>:~$<b></b>
        </div>
      </div>
      <div className="foot">
        <span className="seg">block <b>6,317,492</b></span>
        <span className="seg">events/min <b>37</b></span>
        <span className="seg">p95 <b>142ms</b></span>
        <span className="seg">uptime <b className="ok">99.9%</b></span>
      </div>
    </div>
  );
}
