import { z } from 'zod';
import { appChannels } from './app';
import { catalogChannels } from './catalog';
import type { Channel } from './define';
import type { WireError } from '../errors';

export * from './define';
export * from './app';
export * from './catalog';

export const ipcContract = { ...appChannels, ...catalogChannels } satisfies Record<string, Channel>;

export type IpcChannel = keyof typeof ipcContract;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipcContract)[C]['input']>;
export type IpcOutput<C extends IpcChannel> = (typeof ipcContract)[C] extends Channel<z.ZodType, infer O> ? (unknown extends O ? never : O) : never;

/** What actually travels over IPC: data or a structured error. */
export type Wire<T> = { ok: true; data: T } | { ok: false; error: WireError };

export interface PetraApi {
  invoke<C extends IpcChannel>(channel: C, ...args: undefined extends IpcInput<C> ? [input?: IpcInput<C>] : [input: IpcInput<C>]): Promise<IpcOutput<C>>;
}
