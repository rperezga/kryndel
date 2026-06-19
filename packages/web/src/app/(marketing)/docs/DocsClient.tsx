'use client';
/**
 * DocsClient — loads Redoc from CDN and renders the OpenAPI spec.
 * Redoc is the only external script; it is loaded from cdnjs (allowed CDN).
 * The spec is fetched from the same-origin /api/v1/openapi.json.
 */
import { useEffect, useRef } from 'react';

export default function DocsClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only inject the script once
    if (document.getElementById('redoc-script')) {
      initRedoc();
      return;
    }

    const script = document.createElement('script');
    script.id = 'redoc-script';
    // Redoc standalone bundle from cdnjs (allowed CDN per Kryndel rules)
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/redoc/2.1.3/bundles/redoc.standalone.min.js';
    script.defer = true;
    script.onload = initRedoc;
    document.body.appendChild(script);

    function initRedoc() {
      // @ts-expect-error — Redoc is injected as a global
      if (typeof Redoc === 'undefined') return;
      if (!containerRef.current) return;
      // @ts-expect-error
      Redoc.init(
        '/api/v1/openapi.json',
        {
          theme: {
            colors: {
              primary: { main: '#4ef0c0' },
              text: { primary: '#e9eefb', secondary: '#93a0c4' },
            },
            typography: {
              fontSize: '15px',
              fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
              headings: { fontFamily: '"Hanken Grotesk", system-ui, sans-serif' },
              code: { fontFamily: '"JetBrains Mono", "Fira Mono", monospace', fontSize: '13px' },
            },
            sidebar: {
              backgroundColor: '#0a0e1a',
              textColor: '#93a0c4',
            },
            rightPanel: {
              backgroundColor: '#0d1322',
            },
          },
          hideDownloadButton: false,
          disableSearch: false,
          expandResponses: '200,201',
          nativeScrollbars: false,
        },
        containerRef.current,
      );
    }

    return () => {
      // Cleanup: Redoc doesn't expose an unmount, but this avoids double-init
    };
  }, []);

  return (
    <>
      <div
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--signal)',
            margin: 0,
          }}
        >
          Kryndel API Docs
        </h1>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            background: 'rgba(78,240,192,.08)',
            border: '1px solid rgba(78,240,192,.2)',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          REST API v1
        </span>
        <a
          href="/api/v1/openapi.json"
          style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--signal)' }}
          target="_blank"
          rel="noopener noreferrer"
        >
          openapi.json ↗
        </a>
      </div>

      <div
        ref={containerRef}
        id="redoc-container"
        aria-label="API documentation"
        style={{ minHeight: '80vh' }}
      />
    </>
  );
}
