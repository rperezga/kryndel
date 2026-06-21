'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { StatusChip } from './Badge';

export interface TxPillProps extends React.HTMLAttributes<HTMLDivElement> {
  hash: string;
  status?: 'success' | 'reverted' | 'pending';
  explorerUrl?: string;
}

export function TxPill({
  className,
  hash,
  status,
  explorerUrl,
  ...props
}: TxPillProps) {
  const [copied, setCopied] = useState(false);

  const displayHash = React.useMemo(() => {
    if (!hash) return '';
    if (hash.length <= 12) return hash;
    return `${hash.substring(0, 6)}…${hash.substring(hash.length - 4)}`;
  }, [hash]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Failed to copy tx hash:', err);
    }
  };

  const statusMap = {
    success: { status: 'ok' as const, label: 'Success' },
    reverted: { status: 'fail' as const, label: 'Reverted' },
    pending: { status: 'warn' as const, label: 'Pending' },
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 bg-ds-panel border border-solid border-ds-border rounded-lg py-1 pl-3 pr-2 font-ds-mono text-xs select-none transition-all duration-150',
        'hover:border-ds-border-on text-ds-text-2 hover:text-ds-text',
        className
      )}
      {...props}
    >
      {/* Transaction Icon */}
      <svg
        className="w-3.5 h-3.5 text-ds-text-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 17l6-6-6-6M12 19h10" />
      </svg>

      {/* Truncated Hash (Optionally link to explorer) */}
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ds-green outline-none focus-visible:text-ds-green no-underline font-semibold tracking-tight cursor-pointer"
        >
          {displayHash}
        </a>
      ) : (
        <span className="font-semibold tracking-tight select-all">{displayHash}</span>
      )}

      {/* Copy Action Button */}
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'p-0.5 flex items-center justify-center bg-transparent border-0 rounded hover:bg-ds-panel-2 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green',
          copied ? 'text-ds-green' : 'text-ds-text-3 hover:text-ds-text-2'
        )}
        aria-label={copied ? 'Transaction hash copied to clipboard' : 'Copy transaction hash'}
        title={copied ? 'Copied!' : 'Copy Hash'}
      >
        {copied ? (
          <span className="font-ds-mono text-[9px] uppercase tracking-wide font-bold px-0.5">Copied</span>
        ) : (
          <svg
            className="w-3 h-3 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      {/* Status Chip Inline */}
      {status && (
        <div className="ml-1 pl-1.5 border-0 border-l border-solid border-ds-border">
          <StatusChip
            status={statusMap[status].status}
            label={statusMap[status].label}
          />
        </div>
      )}
    </div>
  );
}
