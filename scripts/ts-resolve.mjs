/**
 * Module resolution hooks so `node --test` can run the app's TypeScript
 * directly, with no build step and no test framework.
 *
 * Node strips types natively but resolves specifiers strictly: the app writes
 * `./constants` and `@/lib/types`, which a bundler understands and Node does
 * not. These two hooks teach it both, and nothing else changes.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.resolve(import.meta.dirname, '..', 'src');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];

function firstThatExists(base) {
  if (existsSync(base) && path.extname(base)) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, 'index' + ext);
    if (existsSync(index)) return index;
  }
  return null;
}

export function resolve(specifier, context, next) {
  // The `@/*` alias from tsconfig.
  if (specifier.startsWith('@/')) {
    const hit = firstThatExists(path.join(SRC, specifier.slice(2)));
    if (hit) return next(pathToFileURL(hit).href, context);
  }

  // Extensionless relative imports.
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const from = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const hit = firstThatExists(path.resolve(from, specifier));
    if (hit) return next(pathToFileURL(hit).href, context);
  }

  return next(specifier, context);
}
