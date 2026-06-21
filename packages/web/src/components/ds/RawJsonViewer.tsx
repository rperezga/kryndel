'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from './cn';

export interface RawJsonViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: unknown;
  initiallyExpanded?: boolean;
}

interface JsonNodeProps {
  label?: string;
  value: unknown;
  isLast: boolean;
  depth: number;
  initiallyExpanded: boolean;
}

function JsonNode({ label, value, isLast, depth, initiallyExpanded }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0 || initiallyExpanded);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const getIndent = () => '  '.repeat(depth);

  // Helper to determine type
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  // Key Label rendering
  const renderLabel = () => {
    if (!label) return null;
    return <span className="text-ds-green font-semibold">"{label}": </span>;
  };

  // Primitive node rendering
  if (!isObject) {
    let valueStr = '';
    let valueClass = '';

    if (value === null) {
      valueStr = 'null';
      valueClass = 'text-ds-text-3 font-bold';
    } else if (typeof value === 'string') {
      valueStr = `"${value}"`;
      valueClass = 'text-ds-amber';
    } else if (typeof value === 'number') {
      valueStr = String(value);
      valueClass = 'text-ds-text-2 font-semibold';
    } else if (typeof value === 'boolean') {
      valueStr = String(value);
      valueClass = 'text-ds-text-2 font-bold';
    } else {
      valueStr = String(value);
      valueClass = 'text-ds-text-2';
    }

    return (
      <div className="font-ds-mono text-xs whitespace-pre select-text leading-relaxed">
        {getIndent()}
        {renderLabel()}
        <span className={valueClass}>{valueStr}</span>
        {!isLast && <span className="text-ds-text-3">,</span>}
      </div>
    );
  }

  // Object / Array handling
  const entries = isArray ? value : Object.entries(value);
  const isEmpty = entries.length === 0;
  const startBrace = isArray ? '[' : '{';
  const endBrace = isArray ? ']' : '}';

  if (isEmpty) {
    return (
      <div className="font-ds-mono text-xs whitespace-pre leading-relaxed">
        {getIndent()}
        {renderLabel()}
        <span className="text-ds-text-2">{startBrace}{endBrace}</span>
        {!isLast && <span className="text-ds-text-3">,</span>}
      </div>
    );
  }

  return (
    <div className="font-ds-mono text-xs leading-relaxed select-text">
      {/* Header node: key and open brace/bracket with expander */}
      <div
        onClick={toggleExpand}
        className="flex items-center gap-1 cursor-pointer hover:bg-ds-panel-2/50 rounded px-1 -mx-1 select-none whitespace-pre"
      >
        <span>{getIndent()}</span>
        {/* Toggle Icon */}
        <span className="text-ds-text-3 font-ds-mono text-[9px] w-2 inline-block">
          {expanded ? '▼' : '▶'}
        </span>
        {renderLabel()}
        <span className="text-ds-text-2">{startBrace}</span>
        {!expanded && (
          <>
            <span className="text-ds-text-3 text-[10px] bg-ds-panel border border-solid border-ds-border px-1 py-0.5 rounded mx-1">
              {isArray ? `${entries.length} items` : `${Object.keys(value).length} keys`}
            </span>
            <span className="text-ds-text-2">{endBrace}</span>
            {!isLast && <span className="text-ds-text-3">,</span>}
          </>
        )}
      </div>

      {/* Child Nodes */}
      {expanded && (
        <div className="space-y-0.5">
          {isArray
            ? entries.map((item, idx) => (
                <JsonNode
                  key={idx}
                  value={item}
                  isLast={idx === entries.length - 1}
                  depth={depth + 1}
                  initiallyExpanded={initiallyExpanded}
                />
              ))
            : (entries as [string, unknown][]).map(([key, val], idx) => (
                <JsonNode
                  key={key}
                  label={key}
                  value={val}
                  isLast={idx === entries.length - 1}
                  depth={depth + 1}
                  initiallyExpanded={initiallyExpanded}
                />
              ))}
        </div>
      )}

      {/* Footer node: closing brace/bracket */}
      {expanded && (
        <div className="whitespace-pre">
          {getIndent()}
          {/* Visual alignment block spacer */}
          <span className="w-2.5 inline-block" />
          <span className="text-ds-text-2">{endBrace}</span>
          {!isLast && <span className="text-ds-text-3">,</span>}
        </div>
      )}
    </div>
  );
}

export function RawJsonViewer({
  className,
  data,
  initiallyExpanded = false,
  ...props
}: RawJsonViewerProps) {
  return (
    <div
      className={cn(
        'bg-ds-shell border border-solid border-ds-border rounded-lg p-5 overflow-x-auto text-ds-text custom-scrollbar select-text',
        className
      )}
      {...props}
    >
      <JsonNode
        value={data}
        isLast={true}
        depth={0}
        initiallyExpanded={initiallyExpanded}
      />
    </div>
  );
}
