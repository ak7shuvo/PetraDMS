import { recoveryNotice, rememberSecondDir } from './safetyApp';
import { PetraError, businessDateFor, SETTING_DEFAULTS, type AppStatus, type BusinessProfile, type Settings } from '@petra/core';
import { get, run } from '../sql';
import { tx, lastClosedDate, type Ctx } from '../ctx';
import { audit } from '../audit';
import { getRaw, loadSettings, saveSetting } from '../settings';
import { seedDefaults } from '../masters';
import { addUser, approve, changeSecret, countUsers, createOwner, listLoginUsers, listUsers, login, recoverOwner, sessionFor, updateUser } from './auth';
import { installLicence, licenceStatus } from './licence';
import type { Dispatcher } from './dispatcher';

export function loadProfile(ctx: Ctx): BusinessProfile {
  const r = get<{ name: string; name_bn: string; address: string; phone: string; email: string; tax_no: string; footer_note: string }>(ctx.db, 'SELECT * FROM business_profile WHERE id = 1');
  return { name: r?.name ?? '', nameBn: r?.name_bn ?? '', address: r?.address ?? '', phone: r?.phone ?? '', email: r?.email ?? '', taxNo: r?.tax_no ?? '', footerNote: r?.footer_note ?? '' };
}

export function saveProfile(ctx: Ctx, p: BusinessProfile, language?: 'bn' | 'en'): BusinessProfile {
  tx(ctx, () => {
    run(ctx.db, 'INSERT OR IGNORE INTO business_profile(id, created_at, updated_at) VALUES(1,?,?)', ctx.now(), ctx.now());
    run(
      ctx.db,
      'UPDATE business_profile SET name=?, name_bn=?, address=?, phone=?, email=?, tax_no=?, footer_note=?, language=COALESCE(?, language), updated_at=? WHERE id = 1',
      p.name, p.nameBn, p.address, p.phone, p.email, p.taxNo, p.footerNote, language ?? null, ctx.now()
    );
    audit(ctx, { action: 'profile.save', entity: 'business_profile', entityId: 1 });
  });
  return loadProfile(ctx);
}

export function currentBusinessDate(ctx: Ctx, settings: Settings): string {
  return businessDateFor(new Date(ctx.now()), settings.rolloverHour, lastClosedDate(ctx.db));
}

export function appStatus(d: Dispatcher): AppStatus {
  const ctx = d.ctx();
  const settings = loadSettings(ctx.db);
  return {
    appVersion: d.host.appVersion,
    needsSetup: countUsers(ctx) === 0,
    session: d.session,
    licence: licenceStatus(ctx, d.env),
    settings,
    profile: loadProfile(ctx),
    businessDate: currentBusinessDate(ctx, settings),
    dataDir: d.host.dataDir,
    recovery: recoveryNotice(ctx),
    demo: getRaw(ctx.db, 'demo_mode') === '1'
  };
}

type SettingsPatch = Partial<Settings>;

export function saveSettings(ctx: Ctx, patch: SettingsPatch): Settings {
  tx(ctx, () => {
    const before = loadSettings(ctx.db);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || !(k in SETTING_DEFAULTS)) continue;
      saveSetting(ctx, k as keyof Settings, v as never);
    }
    audit(ctx, { action: 'settings.save', entity: 'app_settings', before: Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Settings]])), after: patch });
  });
  return loadSettings(ctx.db);
}

/** First-run setup: only allowed while no user exists. Seeds money accounts, expense categories and the licence row. */
export function completeSetup(d: Dispatcher, input: { language: 'bn' | 'en'; business: BusinessProfile; owner: { displayName: string; username: string; kind: 'pin' | 'password'; secret: string }; uiMode: 'simple' | 'full' }) {
  const ctx = d.ctx();
  if (countUsers(ctx) > 0) throw new PetraError('DUPLICATE', 'setup already completed', { what: 'setup' });
  const created = tx(ctx, () => {
    const date = currentBusinessDate(ctx, loadSettings(ctx.db));
    seedDefaults(ctx, date);
    const o = createOwner(ctx, input.owner);
    const octx = { ...ctx, userId: o.id };
    saveProfile(octx, input.business, input.language);
    saveSetting(octx, 'language', input.language);
    saveSetting(octx, 'bnDigits', input.language === 'bn');
    saveSetting(octx, 'uiMode', input.uiMode);
    saveSetting(octx, 'dataDirRecommended', d.host.recommendedDataDir());
    licenceStatus(ctx, d.env); // stamps the trial start
    return o;
  });
  d.session = sessionFor(ctx, created.id);
  return { recoveryCode: created.recoveryCode, session: d.session! };
}

export function registerCoreServices(d: Dispatcher): void {
  d.register('app:health', ({ host }) => host.health());
  d.register('app:status', ({ dispatcher }) => appStatus(dispatcher));

  d.register('setup:dataDirInfo', ({ host, ctx }) => ({ current: host.dataDir, recommended: host.recommendedDataDir(), fresh: countUsers(ctx) === 0 }));
  d.register('setup:chooseDataDir', async ({ host, ctx }) => {
    if (countUsers(ctx) > 0) throw new PetraError('PERMISSION', 'data folder can only be chosen during setup');
    return { path: await host.pickDataDir() };
  });
  d.register('setup:applyDataDir', async ({ host, ctx, input }) => {
    if (countUsers(ctx) > 0) throw new PetraError('PERMISSION', 'data folder can only be chosen during setup');
    await host.applyDataDir(input.path);
    return { path: input.path };
  });
  d.register('setup:complete', ({ dispatcher, input }) => completeSetup(dispatcher, input));

  d.register('auth:users', ({ ctx }) => listLoginUsers(ctx));
  d.register('auth:login', ({ ctx, input, dispatcher }) => {
    const { userId, secret } = input;
    const s = login(ctx, userId, secret);
    dispatcher.session = s;
    return s;
  });
  d.register('auth:logout', ({ dispatcher }) => {
    dispatcher.session = null;
    return null;
  });
  d.register('auth:changeSecret', ({ ctx, session, input }) => {
    const i = input;
    changeSecret(ctx, session!.userId, i.oldSecret, i.kind, i.newSecret);
    return null;
  });
  d.register('auth:recover', ({ ctx, input, dispatcher }) => {
    const i = input;
    const r = recoverOwner(ctx, i.recoveryCode, i.kind, i.newSecret);
    dispatcher.session = r.session;
    return r;
  });
  d.register('auth:approve', ({ ctx, input, dispatcher }) => {
    const i = input;
    const a = approve(ctx, i.userId, i.secret);
    return { ...a, token: dispatcher.issueApproval(a.approverId) };
  });

  d.register('users:list', ({ ctx }) => listUsers(ctx));
  d.register('users:create', ({ ctx, input }) => ({ id: addUser(ctx, input) }));
  d.register('users:update', ({ ctx, input, session }) => {
    const i = input;
    updateUser(ctx, i);
    if (session && i.id === session.userId && (i.active === false || (i.role && i.role !== session.role))) {
      // the signed-in owner changed their own role or deactivated themselves: sign out so the next call re-reads the role
      d.session = null;
    }
    return null;
  });

  d.register('settings:get', ({ ctx }) => loadSettings(ctx.db));
  d.register('settings:save', ({ ctx, input, host }) => {
    const saved = saveSettings(ctx, input);
    // The second backup folder is also remembered outside the database, so start-up recovery can find it if the database is damaged.
    if (input.secondBackupDir !== undefined) rememberSecondDir(host.dataDir, saved.secondBackupDir);
    return saved;
  });
  d.register('profile:get', ({ ctx }) => loadProfile(ctx));
  d.register('profile:save', ({ ctx, input }) => saveProfile(ctx, input));

  d.register('licence:status', ({ ctx, env }) => licenceStatus(ctx, env));
  d.register('licence:install', ({ ctx, env, input }) => installLicence(ctx, env, input.blob));
  d.register('licence:pickFile', async ({ host }) => ({ blob: await host.pickLicenceFile() }));
}
