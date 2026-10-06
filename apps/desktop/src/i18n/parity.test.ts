import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'locales');
const files = readdirSync(join(root, 'en')).filter((f) => f.endsWith('.json'));
const read = (lang: string, f: string) => JSON.parse(readFileSync(join(root, lang, f), 'utf8')) as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('i18n key parity', () => {
  it('has the same files in both languages', () => {
    expect(readdirSync(join(root, 'bn')).filter((f) => f.endsWith('.json')).sort()).toEqual(files.sort());
  });
  for (const f of files) {
    it(`${f}: same keys, same placeholders, no empty values`, () => {
      const en = read('en', f);
      const bn = read('bn', f);
      expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en)) {
        expect(en[k]!.trim(), `en ${k}`).not.toBe('');
        expect(bn[k]!.trim(), `bn ${k}`).not.toBe('');
        expect(placeholders(bn[k]!), `placeholders of ${k}`).toBe(placeholders(en[k]!));
      }
    });
  }
});
