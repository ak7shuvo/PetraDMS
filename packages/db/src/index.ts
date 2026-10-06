import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

export interface HealthInfo {
  sqliteVersion: string;
  journalMode: string;
  synchronous: number;
  foreignKeys: number;
  integrity: string;
}

/**
 * Opens a database with the pragmas required by the architecture plan (section 3):
 * WAL journal, synchronous=FULL, foreign keys on.
 */
export function openDatabase(file: string): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

export function healthInfo(db: Db): HealthInfo {
  const one = (sql: string): Record<string, unknown> => (db.prepare(sql).get() ?? {}) as Record<string, unknown>;
  return {
    sqliteVersion: String(one('SELECT sqlite_version() AS v').v),
    journalMode: String(one('PRAGMA journal_mode').journal_mode),
    synchronous: Number(one('PRAGMA synchronous').synchronous),
    foreignKeys: Number(one('PRAGMA foreign_keys').foreign_keys),
    integrity: String(one('PRAGMA integrity_check').integrity_check)
  };
}
