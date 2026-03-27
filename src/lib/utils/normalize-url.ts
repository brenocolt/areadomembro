/**
 * Normalizes a URL, adding https:// protocol if missing.
 * Prevents links like "www.youtube.com" from being treated as relative paths.
 */
export function normalizeUrl(url: string): string {
    if (!url) return url;
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\/\//i.test(trimmed)) return `https:${trimmed}`;
    return `https://${trimmed}`;
}
