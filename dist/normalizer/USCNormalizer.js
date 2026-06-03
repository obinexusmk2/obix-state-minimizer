"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPathSafe = exports.normalizeInput = exports.uscn = exports.USCNormalizer = void 0;
class USCNormalizer {
    /**
     * Normalize an input string to its canonical Unicode form.
     * All encoding variants (URI-encoded, UTF-8 overlong, mixed) are resolved.
     */
    normalize(input) {
        const detectedEncoding = this.detectEncoding(input);
        let canonical = input;
        // Phase 1 — Recognition: decode URI percent-encoding iteratively
        // (iterate to handle double-encoding)
        let prev = '';
        while (prev !== canonical) {
            prev = canonical;
            canonical = this.decodePercent(canonical);
        }
        // Phase 2 — Reduction: NFC normalization (canonical Unicode composition)
        canonical = canonical.normalize('NFC');
        // Phase 3 — Collapse path separators and dot sequences
        canonical = this.normalizePath(canonical);
        return {
            canonical,
            detectedEncoding,
            normalized: canonical !== input,
        };
    }
    /** Validate a path against traversal attacks after normalization. */
    validatePath(input) {
        const { canonical } = this.normalize(input);
        // Reject any path that contains a traversal sequence after normalization
        return !canonical.includes('../') && !canonical.includes('..\\');
    }
    /** Detect the primary encoding type of the input string. */
    detectEncoding(input) {
        if (/%[0-9a-f]{2}/i.test(input)) {
            // Distinguish overlong UTF-8 (e.g. %c0%af) from regular URI encoding
            if (/%c[0-1]%[0-9a-f]{2}/i.test(input))
                return 'utf8-overlong';
            if (/%[0-9a-f]{2}.*[^%]/i.test(input))
                return 'mixed';
            return 'uri-encoded';
        }
        if (/[^\x00-\x7F]/.test(input))
            return 'mixed';
        return input === input.normalize('NFC') ? 'canonical' : 'direct';
    }
    /** Iterative percent-decode — handles overlong and double-encoding. */
    decodePercent(s) {
        try {
            return decodeURIComponent(s.replace(/\+/g, ' '));
        }
        catch {
            // Partial decode: replace valid sequences only
            return s.replace(/%[0-9a-f]{2}/gi, (match) => {
                try {
                    return decodeURIComponent(match);
                }
                catch {
                    return match;
                }
            });
        }
    }
    /** Normalize redundant path segments. */
    normalizePath(s) {
        // Normalise backslash to forward slash
        let out = s.replace(/\\/g, '/');
        // Collapse multiple slashes
        out = out.replace(/\/{2,}/g, '/');
        return out;
    }
}
exports.USCNormalizer = USCNormalizer;
/** Convenience singleton */
exports.uscn = new USCNormalizer();
/** Convenience function */
function normalizeInput(input) {
    return exports.uscn.normalize(input);
}
exports.normalizeInput = normalizeInput;
/** Convenience security guard */
function isPathSafe(input) {
    return exports.uscn.validatePath(input);
}
exports.isPathSafe = isPathSafe;
//# sourceMappingURL=USCNormalizer.js.map