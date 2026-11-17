export const SITE: string;
export const RETIRED: string[];
export function redirectPage(target: string, title: string): string;
export function docsNotFoundPage(map: Record<string, string>, prefix?: string): string;
export function docsMapping(redirects: Record<string, string>, oldPaths?: string[]): Record<string, string>;
export function docsFiles(redirects: Record<string, string>, oldPaths?: string[]): Record<string, string>;
export function playFiles(): Record<string, string>;
export const TEXT_FILES: Record<string, string>;
