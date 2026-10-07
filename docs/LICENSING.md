# PetraDMS licensing

PetraDMS is sold under an **offline licence**. Nothing is checked over the internet, and the program never contacts a licence server. A customer gets a small signed file that is tied to their computer, and the program checks the signature itself.

## The two files people confuse

| File | Who holds it | What it is |
|---|---|---|
| `licence.petra` (any `*.petra` file) | the **customer** | The licence. Signed text that unlocks one computer. Safe to email or send by WhatsApp. |
| `petra-licence-private.pem` | **only the vendor (Petra)** | The *private signing key*. Whoever has it can issue valid licences for every copy of PetraDMS. It is not a licence and must never be sent to a customer, committed to Git, or stored in GitHub. |

There is no `.pme` format in PetraDMS. If you have a file ending in `.pem`, it is the private signing key above.

## How the licence works

A licence file is one line: `base64url(payload).base64url(signature)`.

The payload is JSON:

| Field | Meaning |
|---|---|
| `v` | Format version (1). |
| `customer` | Customer or business name, shown in Settings, Licence. |
| `edition` | Product edition (default `standard`). |
| `machine` | The 16-character Machine Code of the computer the licence is for. |
| `issuedAt` | Issue date. |
| `expiresAt` | Last valid day (`YYYY-MM-DD`), or empty for a licence that never expires. |

The signature is **Ed25519** over the exact payload bytes. The matching public key is built into the program (`packages/db/src/app/publicKey.ts`); the private key is not in the repository. Changing even one character of the file, or editing the expiry date, makes the signature fail, so a licence cannot be forged or extended by editing text.

### Machine Code

The code shown under Settings, Licence is a short fingerprint of the computer:

- On Windows it is derived from the Windows **MachineGuid** (written when Windows was installed). Renaming the PC or changing the CPU does not change it.
- Where no such identifier exists it falls back to the PC name, CPU model, platform and architecture.

Reinstalling PetraDMS keeps the code. Reinstalling Windows or moving to another PC gives a new code, so a new licence is needed.

## What the customer sees

1. **Trial.** A new install runs for **30 days** with every feature. Settings, Licence shows the days left, and a banner reminds the user.
2. **Licensed.** After a licence is installed, Settings, Licence shows the customer name, edition and expiry date.
3. **Expired** (trial over, or the licence passed its last day). PetraDMS becomes **read-only**: the user can still open everything, view, search, print, export and back up, so their data is never held hostage. Posting new sales, purchases, payments and other records is blocked until a valid licence is installed.
4. **Clock set back.** If the computer's clock is moved back by more than a day, PetraDMS goes read-only until the clock is correct. This is what stops someone extending a trial by changing the date.

## Where it is stored

In the shop's database (`petra.db`), table `license_state`: the trial start date, the highest date the program has seen, and the licence file text. It is included in backups. It is checked again on every start, so copying the file around does nothing.

## Issuing a licence (vendor)

One-time setup, on a computer that is **not** used for building releases:

```bash
pnpm keygen generate-keys --out ./keys      # only ever done once; see "Key custody"
```

Per customer:

1. The customer opens **Settings, Licence**, presses **Copy code**, and sends you the Machine Code (looks like `ABCD-1234-EF56-7890`).
2. You issue the licence:
   ```bash
   pnpm keygen issue --key /safe/place/petra-licence-private.pem \
       --customer "Rahim Traders" --edition standard \
       --machine ABCD-1234-EF56-7890 --expires 2027-12-31 --out rahim.petra
   ```
   Leave out `--expires` for a licence that does not expire.
3. Check it: `pnpm keygen verify --file rahim.petra`.
4. Send `rahim.petra` to the customer by email or WhatsApp.
5. The customer opens **Settings, Licence, Choose licence file** (or pastes the text) and presses Install. The status changes to Licensed immediately; nothing else is needed.

### Renewal, replacement, revocation

- **Renewal or replacement:** issue a new file for the same Machine Code with a later `--expires` and install it; it replaces the old one.
- **New computer:** issue a new file for the new Machine Code.
- **Revocation:** an offline licence cannot be taken back remotely. Control it with expiry dates (for example yearly licences). A customer who stops paying simply does not receive the next file, and the program goes read-only on the expiry date.

## Key custody

- The private key lives only with the vendor, offline (an encrypted USB drive, and a second copy in a safe place). It is **not** needed by GitHub Actions and must **not** be added as a repository secret: building and releasing the installer never signs a licence.
- If the private key is lost you can no longer issue licences for existing builds. The remedy is to generate a new key pair, put the new public key in `publicKey.ts`, release a new version, and re-issue licences. Back the key up.
- If the private key leaks, do the same: new key pair, new release, re-issue.
- The repository contains a test (`packages/db/src/secrets.test.ts`) that fails CI if a private key or certificate is committed.

## Honest limits

An offline licence cannot be perfect. A determined person with programming skills could modify the program itself, and deleting the whole data folder resets the trial (and also deletes all the shop's records, which is a high price). The scheme is designed to stop casual copying, editing of licence files and date changes, without ever requiring the internet and without locking customers out of their own data.

## Code signing is separate

The Windows installer's digital signature (which affects the SmartScreen warning) has nothing to do with these licences. See `docs/RELEASING.md`.
