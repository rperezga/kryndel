'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { useAddressLabel } from './AddressLabelProvider';

export interface AddressPillProps extends React.HTMLAttributes<HTMLDivElement> {
  address: string;
  checksum?: boolean;
  showWatchIcon?: boolean;
  isWatching?: boolean;
  onWatchToggle?: (address: string, nextState: boolean) => void;
  explorerUrl?: string;
}

export function AddressPill({
  className,
  address,
  checksum = true,
  showWatchIcon = false,
  isWatching = false,
  onWatchToggle,
  explorerUrl,
  ...props
}: AddressPillProps) {
  const [copied, setCopied] = useState(false);
  const label = useAddressLabel(address);

  // Simple middle truncation: e.g. 0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67 -> 0xe4c3…1ea67
  const displayAddress = React.useMemo(() => {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.substring(0, 6)}…${address.substring(address.length - 5)}`;
  }, [address]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleWatchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onWatchToggle) {
      onWatchToggle(address, !isWatching);
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 bg-ds-panel border border-solid border-ds-border rounded-full py-0.5 pl-3 pr-2.5 max-w-full text-ds-text-2 font-ds-mono text-xs select-none transition-all duration-150',
        'hover:border-ds-border-on hover:text-ds-text',
        className
      )}
      {...props}
    >
      {/* Address — shows a human label (when known) + the truncated address */}
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={label ? address : undefined}
          className="hover:text-ds-green outline-none focus-visible:text-ds-green no-underline tracking-tight cursor-pointer inline-flex items-center gap-1.5 min-w-0"
        >
          {label ? (
            <>
              <span className="font-semibold text-ds-green truncate">{label}</span>
              <span className="font-normal text-ds-text-3 shrink-0">{displayAddress}</span>
            </>
          ) : (
            <span className="font-semibold">{displayAddress}</span>
          )}
        </a>
      ) : (
        <span
          title={label ? address : undefined}
          className="tracking-tight inline-flex items-center gap-1.5 min-w-0"
        >
          {label ? (
            <>
              <span className="font-semibold text-ds-green truncate">{label}</span>
              <span className="font-normal text-ds-text-3 shrink-0 select-all">{displayAddress}</span>
            </>
          ) : (
            <span className="font-semibold select-all">{displayAddress}</span>
          )}
        </span>
      )}

      {/* Copy Action Button */}
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'p-1 flex items-center justify-center bg-transparent border-0 rounded hover:bg-ds-panel-2 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green',
          copied ? 'text-ds-green' : 'text-ds-text-3 hover:text-ds-text-2'
        )}
        aria-label={copied ? 'Address copied to clipboard' : 'Copy address to clipboard'}
        title={copied ? 'Copied!' : 'Copy Address'}
      >
        {copied ? (
          <span className="font-ds-mono text-[9px] uppercase tracking-wide font-bold px-0.5">Copied</span>
        ) : (
          <svg
            className="w-3.5 h-3.5 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      {/* Optional Watch Toggle Icon */}
      {showWatchIcon && (
        <button
          type="button"
          onClick={handleWatchToggle}
          className={cn(
            'p-1 flex items-center justify-center bg-transparent border-0 rounded hover:bg-ds-panel-2 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green',
            isWatching ? 'text-ds-green' : 'text-ds-text-3 hover:text-ds-text-2'
          )}
          aria-label={isWatching ? 'Stop watching contract' : 'Watch contract'}
          title={isWatching ? 'Watching' : 'Watch'}
        >
          <svg
            className="w-3.5 h-3.5 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              className={isWatching ? 'fill-current' : 'fill-none'}
            />
          </svg>
        </button>
      )}

      {/* External explorer shortcut arrow */}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ds-text-3 hover:text-ds-green p-1 flex items-center justify-center outline-none focus-visible:text-ds-green"
          aria-label="Open in external explorer"
          title="Open in external explorer"
        >
          <svg
            className="w-3 h-3 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      )}
    </div>
  );
}
