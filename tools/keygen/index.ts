/**
 * Vendor licence tool. Keep the private key OUTSIDE the repository.
 *
 *   pnpm keygen generate-keys --out ./keys
 *   pnpm keygen issue --key ./keys/petra-licence-private.pem --customer "Rahim Traders" \
 *        --edition standard --machine ABCD-1234-EF56-7890 [--expires 2027-12-31] [--out licence.petra]
 *   pnpm keygen verify --file licence.petra [--machine ABCD-1234-EF56-7890] [--public ./keys/petra-licence-public.pem]
 *
 * The customer sends the Machine Code shown in Settings > Licence. The licence is bound to that machine.
 * Moving to a new PC means issuing a new licence for the new Machine Code.
 */
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PRODUCT_PUBLIC_KEY_PEM, checkLicence, signLicence, type LicencePayload } from '@petra/db';

function args(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[++i]! : 'true';
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
const a = args(rest);
const need = (k: string): string => {
  const v = a[k];
  if (!v) {
    console.error(`Missing --${k}`);
    process.exit(2);
  }
  return v;
};

if (cmd === 'generate-keys') {
  const dir = path.resolve(a.out ?? './keys');
  mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(path.join(dir, 'petra-licence-private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  writeFileSync(path.join(dir, 'petra-licence-public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  console.log(`Keys written to ${dir}. Put the PUBLIC key into packages/db/src/app/publicKey.ts and rebuild. Never commit the private key.`);
} else if (cmd === 'issue') {
  const key = createPrivateKey(readFileSync(need('key'), 'utf8'));
  const machineCode = need('machine').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (machineCode.length < 16) {
    console.error('Machine code must be the 16-character code shown in the app.');
    process.exit(2);
  }
  if (a.expires && !/^\d{4}-\d{2}-\d{2}$/.test(a.expires)) {
    console.error('--expires must be YYYY-MM-DD');
    process.exit(2);
  }
  // The licence stores the machine code prefix; the app compares against the same 16-character prefix.
  const payload: LicencePayload = {
    v: 1,
    customer: need('customer'),
    edition: a.edition ?? 'standard',
    machine: machineCode.toLowerCase(),
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: a.expires ?? null
  };
  const blob = signLicence(payload, key, (data, k) => edSign(null, data, k));
  const out = path.resolve(a.out ?? 'licence.petra');
  writeFileSync(out, blob + '\n');
  console.log(`Licence for "${payload.customer}" written to ${out}`);
} else if (cmd === 'verify') {
  const blob = readFileSync(need('file'), 'utf8');
  const pem = a.public ? readFileSync(a.public, 'utf8') : PRODUCT_PUBLIC_KEY_PEM;
  const machine = (a.machine ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');
  const body = JSON.parse(Buffer.from(blob.trim().split('.')[0]!, 'base64url').toString('utf8')) as LicencePayload;
  const r = checkLicence(blob, pem, machine || body.machine);
  console.log(r.ok ? `VALID for ${r.payload.customer} (${r.payload.edition}), expires ${r.payload.expiresAt ?? 'never'}` : `INVALID: ${r.problem}`);
  process.exit(r.ok ? 0 : 1);
} else {
  console.error('Usage: pnpm keygen <generate-keys|issue|verify> ...');
  process.exit(2);
}
