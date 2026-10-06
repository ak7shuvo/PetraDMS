import { z } from 'zod';

/**
 * Typed IPC contract. Both the preload bridge and the main-process handlers validate
 * against these schemas, so the renderer never talks to Node directly.
 */
export const healthSchema = z.object({
  appVersion: z.string(),
  electronVersion: z.string(),
  nodeVersion: z.string(),
  sqliteVersion: z.string(),
  journalMode: z.string(),
  synchronous: z.number(),
  foreignKeys: z.number(),
  integrity: z.string(),
  packaged: z.boolean(),
  dataDir: z.string()
});
export type Health = z.infer<typeof healthSchema>;

export const ipcContract = {
  'app:health': { input: z.undefined(), output: healthSchema }
} as const;

export type IpcChannel = keyof typeof ipcContract;
export type IpcInput<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['input']>;
export type IpcOutput<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['output']>;

export interface PetraApi {
  invoke<C extends IpcChannel>(channel: C, input?: IpcInput<C>): Promise<IpcOutput<C>>;
}
