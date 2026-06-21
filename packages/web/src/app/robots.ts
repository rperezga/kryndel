import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/_design'],
    },
    sitemap: 'https://kryndel.dev/sitemap.xml',
  };
}
