import { contextBridge, ipcRenderer } from 'electron';
import { ipcContract, type IpcChannel, type PetraApi } from '@petra/core';

const api: PetraApi = {
  async invoke(channel, input) {
    if (!(channel in ipcContract)) throw new Error(`Unknown channel: ${String(channel)}`);
    const c = channel as IpcChannel;
    const parsed = ipcContract[c].input.parse(input);
    const out: unknown = await ipcRenderer.invoke(c, parsed);
    return ipcContract[c].output.parse(out) as never;
  }
};

contextBridge.exposeInMainWorld('petra', api);
