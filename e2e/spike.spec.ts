import { test, expect } from '@playwright/test';
import { launch } from './helpers';

test('app launches and node:sqlite runs in WAL mode with integrity ok', async () => {
  const { app, page, consoleErrors } = await launch();
  await expect(page.getByTestId('title')).toHaveText('PetraDMS');
  await expect(page.getByTestId('journal-mode')).toHaveText('wal');
  await expect(page.getByTestId('integrity')).toHaveText('ok');
  expect(consoleErrors).toEqual([]);
  await app.close();
});
