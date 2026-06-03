/**
 * USCNormalizer — Unicode-Only Structural Charset Normalizer.
 *
 * Applies isomorphic reduction: different encodings of the same character
 * sequence are collapsed to a single canonical form before validation.
 *
 * Security invariant: validate(normalize(s)) ≡ validate(canonical(s))
 *
 * Based on: Okpala, N.M. (2025). Isomorphic Reduction — Not a Bug, But a
 *           Feature. OBINexus Computing Whitepaper.
 */
import type { USCNResult } from '../types';
export declare class USCNormalizer {
    /**
     * Normalize an input string to its canonical Unicode form.
     * All encoding variants (URI-encoded, UTF-8 overlong, mixed) are resolved.
     */
    normalize(input: string): USCNResult;
    /** Validate a path against traversal attacks after normalization. */
    validatePath(input: string): boolean;
    /** Detect the primary encoding type of the input string. */
    private detectEncoding;
    /** Iterative percent-decode — handles overlong and double-encoding. */
    private decodePercent;
    /** Normalize redundant path segments. */
    private normalizePath;
}
/** Convenience singleton */
export declare const uscn: USCNormalizer;
/** Convenience function */
export declare function normalizeInput(input: string): USCNResult;
/** Convenience security guard */
export declare function isPathSafe(input: string): boolean;
//# sourceMappingURL=USCNormalizer.d.ts.map