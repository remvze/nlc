import { existsSync, readFileSync } from 'node:fs';

export function loadFileWithLineNumbers(path: string) {
  if (!existsSync(path)) return null;

  return readFileSync(path, 'utf-8')
    .split('\n')
    .map((line, idx) => `${idx + 1}> ${line}`)
    .join('\n');
}
