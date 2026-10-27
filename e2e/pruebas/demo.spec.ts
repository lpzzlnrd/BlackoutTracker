import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Recorrido de la PWA con los datos de ejemplo (`?demo=`, CANON §11): no necesita Supabase ni
// la API, así que siempre da el mismo resultado. Corre en teléfono (Pixel 7) y en escritorio.

const RUTAS = ['/', '/panel', '/reportar', '/avisos', '/cuenta'] as const;

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
    ['Reportar', '/reportar'],
    ['Avisos', '/avisos'],
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

test('D-037: en el teléfono la barra tiene cinco destinos con Reportar al centro', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'telefono', 'La barra inferior es solo del teléfono');
  await page.goto('/?demo=en-linea');
  const barra = navPrincipal(page);
  await expect(barra.getByRole('link')).toHaveText([
    'Mapa',
    'Panel',
    'Reportar',
    'Avisos',
    'Cuenta',
  ]);
  const caja = await barra.boundingBox();
  const reportar = barra.getByRole('link', { name: 'Reportar' });
  const enlace = await reportar.boundingBox();
  const circulo = await reportar.locator('span').first().boundingBox();
  if (!caja || !enlace || !circulo) throw new Error('La barra no se dibujó');
  // Al centro de la barra, circular y sobresaliendo por arriba.
  expect(Math.abs(enlace.x + enlace.width / 2 - (caja.x + caja.width / 2))).toBeLessThanOrEqual(2);
  expect(circulo.width).toBeGreaterThanOrEqual(56);
  expect(circulo.width).toBe(circulo.height);
  expect(circulo.y).toBeLessThan(caja.y);
});

test('OFF-01: Avisos muestra la cola del dispositivo y la barra cuenta los pendientes', async ({
  page,
}) => {
  await page.goto('/avisos?demo=sin-conexion');
  await expect(page.getByRole('heading', { level: 1, name: 'Tus avisos' })).toBeVisible();
  await expect(page.locator('#cola').getByText('Pendiente').first()).toBeVisible();
  await expect(
    navPrincipal(page).getByRole('link', { name: /Avisos.*1 aviso sin enviar/ }),
  ).toBeVisible();
});

test('Avisos vacío explica qué aparecerá y lleva a Reportar', async ({ page }) => {
  await page.goto('/avisos?demo=en-linea');
  await expect(page.getByText('Aún no tienes avisos')).toBeVisible();
  await page.getByRole('link', { name: 'Reportar un corte' }).click();
  await expect(page).toHaveURL(/\/reportar\?demo=en-linea/);
});

test('D-038: la hoja del mapa abre con el estado, el consenso y el botón de reportar', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'telefono', 'La hoja inferior es solo del teléfono');
  await page.goto('/?demo=en-linea');
  const hoja = page.getByRole('region', { name: 'Sector 1' });
  await expect(hoja.getByText('Sin luz', { exact: true })).toBeVisible();
  await expect(hoja.getByText('Confirmado por al menos 3 vecinos')).toBeVisible();
  await expect(hoja.getByText(/^Llevas \d+ min · lo habitual/)).toBeVisible();
  // Sin expandir la hoja, el botón ya se ve y el círculo de Reportar no lo tapa.
  const boton = await hoja.getByRole('button', { name: 'Ya volvió la luz' }).boundingBox();
  const circulo = await navPrincipal(page)
    .getByRole('link', { name: 'Reportar' })
    .locator('span')
    .first()
    .boundingBox();
  if (!boton || !circulo) throw new Error('La hoja o la barra no se dibujaron');
  expect(boton.y + boton.height).toBeLessThanOrEqual(circulo.y);
});

test('D-038: el selector dice cuántos sectores están sin cada servicio', async ({ page }) => {
  await page.goto('/?demo=en-linea');
  const servicios = page.getByRole('group', { name: 'Servicio' });
  await expect(servicios.getByRole('button', { name: /Luz.*1 sector sin servicio/ })).toBeVisible();
  await expect(servicios.getByRole('button', { name: 'Agua' })).not.toHaveAccessibleName(
    /sin servicio/,
  );
});

test('D-038: el panel resume cuántos sectores hay en cada estado', async ({ page }) => {
  await page.goto('/panel?demo=en-linea');
  await expect(
    page.getByRole('list', { name: 'Sectores por estado' }).getByRole('listitem'),
  ).toHaveText([/1\s*Sin servicio/, /1\s*Sin confirmar/, /2\s*Con servicio/]);
});

test('D-038: Reportar dice qué servicio tiene un corte propio y qué pasa después', async ({
  page,
}) => {
  await page.goto('/reportar?demo=en-linea');
  const servicios = page.getByRole('group', { name: 'Servicio' });
  await expect(servicios.getByRole('button', { name: /Luz.*Corte abierto/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(servicios.getByRole('button', { name: /Agua.*Sin cortes tuyos/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '¿Ya volvió la luz?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Después de avisar' })).toBeVisible();
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
