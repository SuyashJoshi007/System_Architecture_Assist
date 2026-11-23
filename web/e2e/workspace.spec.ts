import { expect, test } from '@playwright/test';

test('loads the real diagram and fonts, then retains a theme choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.component-node')).toHaveCount(6);
  await expect(page.locator('.react-flow__edge')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: '2 notes' })).toBeVisible();
  const fontStatus = await page.evaluate(async () => {
    await document.fonts.ready;
    return { interface: document.fonts.check('14px "Space Grotesk"'), metadata: document.fonts.check('11px "JetBrains Mono"') };
  });
  expect(fontStatus).toEqual({ interface: true, metadata: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.component-node')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('adds, connects, moves, and persists actual diagram components', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.component-node')).toHaveCount(6);
  await page.getByRole('button', { name: 'Add component', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Payment service');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Process payments');
  await page.getByRole('button', { name: 'Add to canvas' }).click();
  await expect(page.locator('.component-node')).toHaveCount(7);
  const created = page.locator('.react-flow__node').filter({ hasText: 'Payment service' });
  // Move the added card away from the initial API card before connecting it.
  const bounds = await created.boundingBox();
  expect(bounds).not.toBeNull();
  const start = { x: bounds!.x + 40, y: bounds!.y + 30 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 150, start.y + 120, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Connect tool' }).click();
  const source = page.locator('.react-flow__node[data-id="web"] .react-flow__handle[data-handleid="right"]');
  const target = created.locator('.react-flow__handle[data-handleid="left"]');
  await source.dragTo(target);
  await expect(page.locator('.react-flow__edge')).toHaveCount(6);
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.component-node')).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Revision history, current r10' })).toBeVisible();
});

test('an accepted sample creates a revision and makes the remaining old suggestion stale', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept', exact: true }).first().click();
  await expect(page.getByText('Accepted · local draft r08')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Accepted · local draft r08')).toBeVisible();
  await page.getByRole('button', { name: 'Revision history, current r08' }).click();
  await expect(page.getByRole('dialog')).toContainText('Accepted: Handle duplicate events');
});

test('the phone layout has no horizontal overflow and opens a dismissible review drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.component-node')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open AI review panel' }).click();
  await expect(page.getByRole('heading', { name: '2 notes' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Canvas tools' })).toBeHidden();
  await page.getByRole('button', { name: 'Close AI review panel' }).click();
  await expect(page.getByRole('toolbar', { name: 'Canvas tools' })).toBeVisible();
});
