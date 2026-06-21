'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { Button } from './Button';

export interface EmptyWorkbenchProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  actionLabel?: string;
  onActionClick?: () => void;
  codeExample?: string;
  codeLanguage?: string;
}

export function EmptyWorkbench({
  className,
  title,
  description,
  actionLabel,
  onActionClick,
  codeExample,
  codeLanguage = 'bash',
  ...props
}: EmptyWorkbenchProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!codeExample) return;
    try {
      await navigator.clipboard.writeText(codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy code snippet:', err);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 bg-ds-panel border border-solid border-ds-border rounded-lg max-w-xl mx-auto my-8 shadow-lg select-none',
        className
      )}
      {...props}
    >
      {/* Icon decoration */}
      <div className="w-12 h-12 rounded-lg bg-ds-green/5 border border-solid border-ds-green/20 flex items-center justify-center mb-5 text-ds-green">
        <svg
          className="w-6 h-6 fill-none stroke-current stroke-[1.5]"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Headings */}
      <h3 className="font-ds-sans text-base font-bold text-ds-text mb-2">{title}</h3>
      <p className="font-ds-sans text-sm text-ds-text-2 mb-6 max-w-sm leading-relaxed">{description}</p>

      {/* Optional Technical Code Example (e.g. copyable command) */}
      {codeExample && (
        <div className="w-full bg-ds-shell border border-solid border-ds-border rounded-lg mb-6 overflow-hidden text-left relative group">
          <div className="flex justify-between items-center bg-ds-panel-2/50 border-0 border-b border-solid border-ds-border px-4 py-2">
            <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider">
              Example Snippet ({codeLanguage})
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="bg-transparent border-0 font-ds-mono text-[9px] text-ds-green hover:text-ds-green/80 cursor-pointer outline-none focus-visible:underline"
              aria-label="Copy code example"
            >
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto font-ds-mono text-xs text-ds-text-2 custom-scrollbar">
            <code>{codeExample}</code>
          </pre>
        </div>
      )}

      {/* Optional CTA Button */}
      {actionLabel && onActionClick && (
        <Button variant="primary" size="md" onClick={onActionClick} className="px-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
