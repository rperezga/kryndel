/**
 * /docs — API reference rendered with Redoc from CDN.
 * Client Component required for the Redoc script injection.
 * OpenAPI spec served from /api/v1/openapi.json (same origin, no CORS issue).
 */
import type { Metadata } from 'next';
import DocsClient from './DocsClient';

export const metadata: Metadata = {
  title: 'API Docs',
  description:
    'Kryndel REST API v1 reference — contracts, events, rules, webhooks and more. Authenticate with an API key.',
  openGraph: {
    title: 'Kryndel API Docs',
    description: 'Full REST API v1 reference for Kryndel. Powered by OpenAPI 3.1.',
    url: 'https://kryndel.dev/docs',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function DocsPage() {
  return <DocsClient />;
}
