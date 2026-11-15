import { test, expect } from '../fixtures/base';

const DESKTOP = { width: 1440, height: 1000 };

// Routes with no identifier or user-created data. The classroom route is
// intentionally excluded: a real classroom id is required and none is supplied
// by the local environment or a fixture that represents the user's data.
const PUBLIC_ROUTES = [
  { name: 'home', path: '/' },
  { name: 'workspace', path: '/workspace' },
  { name: 'workbench-new', path: '/workbench/new' },
  { name: 'generation-preview', path: '/generation-preview' },
  { name: 'whiteboard-eval', path: '/eval/whiteboard' },
] as const;

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}

for (const route of PUBLIC_ROUTES) {
  test(`desktop visual baseline: ${route.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await testInfo.attach('route-result.json', {
      body: JSON.stringify({ requested: route.path, landed: new URL(page.url()).pathname }),
      contentType: 'application/json',
    });
    await expect(page).toHaveScreenshot(`${route.name}-desktop.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('desktop visual baseline: settings dialog when available', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page);
  const settingsButton = page.locator('button:has(svg.lucide-settings)').first();
  test.skip((await settingsButton.count()) === 0, 'Settings control is not available in this state');
  await settingsButton.click();
  const dialog = page.getByRole('dialog').first();
  test.skip((await dialog.count()) === 0, 'Settings dialog did not open in this state');
  await settle(page);
  await expect(page).toHaveScreenshot('settings-dialog-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
});

test('responsive diagnostic matrix', async ({ page }, testInfo) => {
  const widths = [320, 360, 380, 414, 768];
  const routes = [...PUBLIC_ROUTES];
  const measurements: Array<Record<string, unknown>> = [];

  for (const width of widths) {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const viewport =
        orientation === 'portrait'
          ? { width, height: Math.max(640, Math.round(width * 1.8)) }
          : { width: Math.max(640, Math.round(width * 1.8)), height: width };
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const result = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          const docWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          );
          const interactive = Array.from(
            document.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]',
            ),
          )
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
            })
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName.toLowerCase(),
                label:
                  element.getAttribute('aria-label') ||
                  element.innerText.trim().slice(0, 60) ||
                  element.getAttribute('placeholder') ||
                  '',
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                outsideViewport:
                  rect.right < 0 || rect.left > vw || rect.bottom < 0 || rect.top > vh,
                undersizedTouchTarget: rect.width < 44 || rect.height < 44,
              };
            });

          const safeArea = getComputedStyle(document.documentElement);
          return {
            viewport: { width: vw, height: vh },
            documentWidth: docWidth,
            horizontalOverflow: docWidth > vw,
            safeAreaInsets: {
              top: safeArea.getPropertyValue('--safe-area-inset-top').trim(),
              right: safeArea.getPropertyValue('--safe-area-inset-right').trim(),
              bottom: safeArea.getPropertyValue('--safe-area-inset-bottom').trim(),
              left: safeArea.getPropertyValue('--safe-area-inset-left').trim(),
            },
            interactive,
          };
        });
        measurements.push({
          requestedRoute: route.path,
          landedRoute: new URL(page.url()).pathname,
          orientation,
          requestedViewport: viewport,
          ...result,
        });
      }
    }
  }

  await testInfo.attach('responsive-diagnostics.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
  expect(measurements).toHaveLength(widths.length * 2 * routes.length);
});
