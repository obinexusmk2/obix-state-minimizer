/**
 * Example 04: USCN Input Sanitizer for OBIX Forms
 *
 * OBIX forms accept user input and validate it. Before passing user-supplied
 * values to OBIX actions (or sending them to the server), the USCN normalizer
 * should sanitize encoding variations to prevent:
 *   - Path traversal (../../etc/passwd encoded as %2e%2e%2f)
 *   - Unicode homoglyph attacks
 *   - Double-encoded injection attempts
 *
 * Security invariant: validate(normalize(s)) === validate(canonical(s))
 *
 * Integration: @obinexusltd/obix-component-runtime createInput / createFileUpload
 *              + @obinexusltd/obix-state-minimizer USCNormalizer
 */

import { USCNormalizer, normalizeInput, isPathSafe } from '../src';

const uscn = new USCNormalizer();

// ---------------------------------------------------------------------------
// 1. Text input sanitization (ObixInput)
// ---------------------------------------------------------------------------

console.log('=== USCN + ObixInput ===\n');

const testInputs = [
  { raw: 'hello@example.com',        field: 'email' },
  { raw: '%68%65%6c%6c%6f',          field: 'email (uri-encoded)' },
  { raw: 'user%40example.com',       field: 'email (@ encoded)' },
  { raw: '<script>alert(1)</script>', field: 'text (XSS attempt)' },
  { raw: 'normal text input',        field: 'text' },
];

for (const { raw, field } of testInputs) {
  const { canonical, detectedEncoding, normalized } = uscn.normalize(raw);
  console.log(`Field: ${field}`);
  console.log(`  Raw:       ${raw}`);
  console.log(`  Canonical: ${canonical}`);
  console.log(`  Encoding:  ${detectedEncoding}`);
  console.log(`  Changed:   ${normalized}\n`);
}

// ---------------------------------------------------------------------------
// 2. File path sanitization (ObixFileUpload)
// ---------------------------------------------------------------------------

console.log('=== USCN + ObixFileUpload (path safety) ===\n');

const filePaths = [
  'documents/report.pdf',
  '../../../etc/passwd',
  '%2e%2e%2fetc%2fpasswd',
  '%252e%252e%252f',              // double-encoded
  '%c0%af',                       // UTF-8 overlong
  'uploads/user_123/avatar.png',
  '.%2e/config/secrets.json',
];

for (const path of filePaths) {
  const safe = isPathSafe(path);
  const { canonical } = normalizeInput(path);
  const status = safe ? 'ALLOW' : 'BLOCK';
  console.log(`  [${status}] ${path.padEnd(36)} -> "${canonical}"`);
}

// ---------------------------------------------------------------------------
// 3. Integration: normalizer middleware for OBIX form submit
// ---------------------------------------------------------------------------

console.log(`
=== Integration with @obinexusltd/obix-component-runtime ===

  import { createForm, createInput, createFileUpload } from '@obinexusltd/obix-component-runtime';
  import { USCNormalizer, isPathSafe } from '@obinexusltd/obix-state-minimizer';

  const uscn = new USCNormalizer();

  function sanitizeBeforeSubmit(formData: Record<string, string>) {
    const sanitized: Record<string, string> = {};
    for (const [field, value] of Object.entries(formData)) {
      const { canonical } = uscn.normalize(value);
      sanitized[field] = canonical;
    }
    return sanitized;
  }

  // Validate file upload paths before OBIX renders the file list
  function validateUploadPath(path: string): boolean {
    return isPathSafe(path);
  }

  // Wire into OBIX form submit action
  const form = createForm({ ... });
  let formState = form.state;

  document.getElementById('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = { email: formState.fields.email.value };
    const clean = sanitizeBeforeSubmit(raw);
    // Now safe to send to server or pass to OBIX actions
    console.log('Sanitized:', clean);
  });
`);

// ---------------------------------------------------------------------------
// 4. Search input normalization (ObixSearch / ObixAutocomplete)
// ---------------------------------------------------------------------------

console.log('=== USCN + ObixSearch ===\n');

const searchQueries = [
  'hello world',
  'caf%C3%A9',           // café URI-encoded
  '%73%65%61%72%63%68',  // "search" fully encoded
  'query%20with%20spaces',
];

console.log('Normalizing search queries before passing to ObixSearch:');
for (const q of searchQueries) {
  const { canonical } = uscn.normalize(q);
  console.log(`  "${q}" -> "${canonical}"`);
}

console.log(`
  // In OBIX:
  import { createSearch } from '@obinexusltd/obix-component-runtime';
  import { normalizeInput } from '@obinexusltd/obix-state-minimizer';

  const search = createSearch({ label: 'Search', placeholder: 'Search...' });
  let searchState = search.state;

  function handleSearchInput(rawQuery: string) {
    const { canonical } = normalizeInput(rawQuery);
    searchState = search.actions.change(searchState, canonical);
    document.getElementById('search').innerHTML = search.render(searchState);
  }
`);
