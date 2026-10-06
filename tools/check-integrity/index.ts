import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { checkIntegrity, formatViolations } from '../../packages/db/src/integrity';
import { createTestWorld } from '../../packages/db/src/testkit';
import { buildSimWorld, runSeededScenario, DEFAULT_SIM_CONFIG } from '../../packages/db/src/sim';
import { run } from '../../packages/db/src/sql';

/**
 * pnpm check:integrity               -> self-test: builds a database with the engine, asserts I1-I10, then proves
 *                                       the checker really fails on corrupted data.
 * pnpm check:integrity <petra.db>    -> checks a real database file (read-only).
 * Exits non-zero on the first failing invariant and prints the offending ids.
 */
const arg = process.argv[2];

function fail(text: string): never {
  console.error(text);
  process.exit(1);
}

if (arg && arg !== '--self-test') {
  if (!fs.existsSync(arg)) fail(`No such database: ${arg}`);
  const db = new DatabaseSync(arg, { readOnly: true });
  const v = checkIntegrity(db, { stopAtFirst: true });
  if (v.length > 0) fail(`INTEGRITY FAILED\n${formatViolations(v)}`);
  console.log(`integrity: I1-I10 hold for ${arg}`);
  process.exit(0);
}

const world = createTestWorld();
const w = buildSimWorld(world.ctx, world.managerId, { ...DEFAULT_SIM_CONFIG, taxBp: 500, roundOff: true });
runSeededScenario(w, 20261007, 800);
const ok = checkIntegrity(world.ctx.db, { stopAtFirst: true });
if (ok.length > 0) fail(`INTEGRITY FAILED on the self-test database\n${formatViolations(ok)}`);
if (w.stats.ok < 100) fail(`self-test did too little work (${w.stats.ok} operations accepted)`);

const corruptions: [string, string][] = [
  ['I1', 'UPDATE products SET stock_qty = stock_qty + 1 WHERE id = 1'],
  ['I3', 'UPDATE products SET stock_value = stock_value + 1 WHERE id = 2'],
  ['I4', 'UPDATE customers SET balance = balance + 1 WHERE id = 1'],
  ['I5', 'UPDATE sales SET total = total + 1 WHERE id = (SELECT MIN(id) FROM sales)'],
  ['I6', 'UPDATE money_accounts SET balance = balance + 1 WHERE id = 1']
];
for (const [inv, sql] of corruptions) {
  run(world.ctx.db, 'SAVEPOINT corrupt');
  run(world.ctx.db, sql);
  const v = checkIntegrity(world.ctx.db, { stopAtFirst: true });
  run(world.ctx.db, 'ROLLBACK TO corrupt');
  run(world.ctx.db, 'RELEASE corrupt');
  if (!v.some((x) => x.invariant === inv)) fail(`checker missed corruption for ${inv}`);
}
console.log(`integrity: I1-I10 hold after ${w.stats.ok} accepted operations (${w.stats.rejected} correctly rejected); checker detects corruption of I1, I3, I4, I5, I6`);
world.close();
