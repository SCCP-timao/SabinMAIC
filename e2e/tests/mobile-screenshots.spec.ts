import { test } from '../fixtures/base';
import * as path from 'node:path';
import * as fs from 'node:fs';

const PUBLIC_ROUTES = [
  { name: 'home', path: '/' },
  { name: 'workspace', path: '/workspace' },
  { name: 'workbench-new', path: '/workbench/new' },
  { name: 'generation-preview', path: '/generation-preview' },
  { name: 'whiteboard-eval', path: '/eval/whiteboard' },
] as const;

const WIDTHS = [320, 360, 380, 414, 768] as const;

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'e2e-mobile-screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
});

for (const width of WIDTHS) {
  for (const orientation of ['portrait', 'landscape'] as const) {
    const viewport =
      orientation === 'portrait'
        ? { width, height: Math.max(640, Math.round(width * 1.8)) }
        : { width: Math.max(640, Math.round(width * 1.8)), height: width };

    const label = `${width}px-${orientation}`;

    for (const route of PUBLIC_ROUTES) {
      test(`mobile screenshot: ${route.name} @ ${label}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await settle(page);

        const filename = `${route.name}-${label}.png`;
        await page.screenshot({
          path: path.join(OUTPUT_DIR, filename),
          fullPage: true,
          animations: 'disabled',
        });
      });
    }
  }
}
