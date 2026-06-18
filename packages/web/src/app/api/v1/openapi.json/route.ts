/**
 * GET /api/v1/openapi.json -- serves the OpenAPI 3.1 specification.
 * No auth required.
 */
import { readFileSync }  from 'node:fs';
import { join }          from 'node:path';
import { NextResponse }  from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const specPath = join(process.cwd(), 'public', 'openapi.json');
    const spec     = JSON.parse(readFileSync(specPath, 'utf-8'));
    return NextResponse.json(spec);
  } catch {
    return NextResponse.json({ error: 'OpenAPI spec not available.' }, { status: 500 });
  }
}
