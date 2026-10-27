import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Recorrido de la PWA con los datos de ejemplo (`?demo=`, CANON §11): no necesita Supabase ni
// la API, así que siempre da el mismo resultado. Corre en teléfono (Pixel 7) y en escritorio.

const RUTAS = ['/', '/panel', '/reportar', '/cuenta'] as const;

const navPrincipal = (page: Page) =>
  page.getByRole('navigation', { name: 'Principal' }).locator('visible=true');

test('VIS-01: el mapa abre sin pedir cuenta y nombra los cuatro sectores', async ({ page }) => {
  await page.goto('/?demo=en-linea');
  const mapa = page.getByRole('img', { name: /Mapa de sectores/ });
  await expect(mapa).toBeVisible();
  for (const n of [1, 2, 3, 4]) {
    await expect(mapa).toHaveAttribute('aria-label', new RegExp(`Sector ${n}`));
  }
});

test('OFF-07: sin red se ve lo último guardado con "datos no actualizados"', async ({ page }) => {
  await page.goto('/?demo=sin-conexion');
  await expect(
    page.getByRole('status').filter({ hasText: 'datos no actualizados' }).first(),
  ).toBeVisible();
});

test('la navegación principal lleva a cada pantalla y conserva el modo demo', async ({ page }) => {
  await page.goto('/?demo=en-linea');
  for (const [texto, ruta] of [
    ['Panel', '/panel'],
    ['Cuenta', '/cuenta'],
    ['Mapa', '/'],
  ] as const) {
    await navPrincipal(page).getByRole('link', { name: texto }).click();
    await expect(page).toHaveURL(new RegExp(`${ruta === '/' ? '/\\?' : ruta}.*demo=en-linea`));
    await expect(navPrincipal(page).getByRole('link', { name: texto })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

for (const ruta of RUTAS) {
  test(`VIS-05: sin scroll horizontal a 320 px en ${ruta}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${ruta}?demo=en-linea`);
    await page.waitForLoadState('networkidle');
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });

  test(`CANON §8: axe sin violaciones graves ni críticas en ${ruta}`, async ({ page }) => {
    await page.goto(`${ruta}?demo=en-linea`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page })
      .exclude('.leaflet-tile-pane') // las teselas de OSM no son nuestras
      .analyze();
    const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
