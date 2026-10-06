import type { z } from 'zod';
import { ipcContract, toWireError, type IpcChannel, type IpcOutput, type SessionDto, type Wire, PetraError, type Health } from '@petra/core';
import { randomBytes } from 'node:crypto';
import type { PrintFormat } from '@petra/core';
import type { Db } from '../sql';
import { makeCtx, type Ctx } from '../ctx';
import { assertWritable, licenceStatus, type LicenceEnv } from './licence';

/** Things only the Electron main process can do. Injected so the services stay testable without Electron. */
export interface Host {
  appVersion: string;
  dataDir: string;
  health(): Health;
  pickDataDir(): Promise<string | null>;
  applyDataDir(path: string): Promise<void>;
  recommendedDataDir(): string;
  pickLicenceFile(): Promise<string | null>;
  /** @font-face CSS with the bundled fonts embedded as base64, so printed pages and PDFs carry Bangla glyphs. */
  fontCss(): string;
  printHtml(html: string, o: { format: PrintFormat; silent: boolean; printerName: string }): Promise<void>;
  /** Renders the HTML to a PDF file at `file` (fonts embedded). */
  pdfHtml(html: string, o: { format: PrintFormat; file: string }): Promise<void>;
  reveal(path: string): void;
}

export interface CallArgs<I = unknown> {
  ctx: Ctx;
  session: SessionDto | null;
  input: I; // validated by the channel's zod schema before the handler runs
  host: Host;
  env: LicenceEnv;
  dispatcher: Dispatcher;
}
export type Handler<C extends IpcChannel = IpcChannel> = (a: CallArgs<z.output<(typeof ipcContract)[C]['input']>>) => IpcOutput<C> | Promise<IpcOutput<C>>;
type AnyHandler = (a: CallArgs) => unknown;

const RANK = { public: 0, user: 1, manager: 2, owner: 3 } as const;
const ROLE_RANK = { staff: 1, manager: 2, owner: 3 } as const;

export class Dispatcher {
  session: SessionDto | null = null;
  private approvals = new Map<string, { approverId: number; forUser: number; expires: number }>();
  private handlers = new Map<string, AnyHandler>();

  constructor(
    public db: Db,
    public env: LicenceEnv,
    public host: Host,
    public now: () => string = () => new Date().toISOString()
  ) {}

  register<C extends IpcChannel>(channel: C, h: Handler<C>): void {
    this.handlers.set(channel, h as unknown as AnyHandler);
  }

  /** One-time approval token, valid 5 minutes for the user who asked for it. */
  issueApproval(approverId: number): string {
    const token = randomBytes(18).toString('base64url');
    this.approvals.set(token, { approverId, forUser: this.session?.userId ?? 0, expires: Date.parse(this.now()) + 5 * 60_000 });
    return token;
  }

  peekApproval(token: string | undefined): number | null {
    if (!token) return null;
    const a = this.approvals.get(token);
    if (!a || a.expires < Date.parse(this.now()) || a.forUser !== (this.session?.userId ?? 0)) return null;
    return a.approverId;
  }

  consumeApproval(token: string | undefined): void {
    if (token) this.approvals.delete(token);
  }

  /** Replace the database handle (restore, data-folder move). The session is cleared. */
  swapDb(db: Db): void {
    this.db = db;
    this.session = null;
  }

  ctx(): Ctx {
    return makeCtx(this.db, this.session?.userId ?? null, this.now);
  }

  /** The single entry point used by IPC: validate, authorise, guard licence, run, wrap errors. */
  async call(channel: string, raw: unknown): Promise<Wire<unknown>> {
    try {
      const def = (ipcContract as Record<string, (typeof ipcContract)[IpcChannel]>)[channel];
      const handler = this.handlers.get(channel);
      if (!def || !handler) throw new PetraError('NOT_FOUND', `unknown channel ${channel}`, { what: 'channel' });
      const parsed = def.input.safeParse(raw);
      if (!parsed.success) {
        throw new PetraError('INVALID_INPUT', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), { field: String(parsed.error.issues[0]?.path[0] ?? '') });
      }
      if (def.access !== 'public') {
        if (!this.session) throw new PetraError('PERMISSION', 'sign in required');
        if (ROLE_RANK[this.session.role] < RANK[def.access]) throw new PetraError('PERMISSION', `${def.access} role required`);
      }
      const ctx = this.ctx();
      if (def.write) assertWritable(ctx, this.env);
      const data = await handler({ ctx, session: this.session, input: parsed.data, host: this.host, env: this.env, dispatcher: this });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: toWireError(e) };
    }
  }

  licence() {
    return licenceStatus(this.ctx(), this.env);
  }
}
