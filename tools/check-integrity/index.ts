import { DatabaseSync } from 'node:sqlite';

// Phase 1 baseline: only I10 (SQLite integrity + foreign keys). Phase 2 extends this to I1-I10.
const db = new DatabaseSync(':memory:');
const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
const fk = db.prepare('PRAGMA foreign_key_check').all();
if (integrity.integrity_check !== 'ok' || fk.length > 0) {
  console.error('I10 failed', integrity, fk);
  process.exit(1);
}
console.log('integrity: I10 ok (self-test)');
