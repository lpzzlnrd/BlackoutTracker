import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// La bienvenida y la guía (T-071, D-041). `&vecino=visitante` abre la demo sin sesión: es la
// primera visita de alguien que todavía no tiene cuenta. Cada prueba arranca con el almacenamiento
// vacío, así que el modal siempre sale la primera vez.

const VISITANTE = '?demo=en-linea&vecino=visitante';

const bienvenida = (page: Page) => page.getByRole('dialog', { name: '¿Nuevo en BlackoutTracker?' });

test('D-041: la primera visita sin cuenta abre la bienvenida y lleva a la guía', async ({
  page,
}) => {
  await page.goto(`/${VISITANTE}`);
  const dialogo = bienvenida(page);
  await expect(dialogo).toBeVisible();
  // El foco empieza en la acción principal.
  await expect(dialogo.getByRole('button', { name: 'Ver la guía' })).toBeFocused();

  await dialogo.getByRole('button', { name: 'Ver la guía' }).click();
  await expect(page).toHaveURL(/\/guia\?demo=en-linea/);
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona' })).toBeVisible();
  await expect(page.locator('ol > li')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: /Cómo se confirma un corte/ })).toBeVisible();
  // Sin cuenta, la guía termina en crearla, y "Crear cuenta" abre Entrar en ese modo.
  await page.getByRole('link', { name: 'Crear cuenta' }).last().click();
  await expect(page).toHaveURL(/\/entrar\?.*modo=crear/);
  await expect(page.getByLabel('Contraseña')).toHaveAttribute('autocomplete', 'new-password');
});

test('D-041: "Ahora no" y Escape cierran la bienvenida y no vuelve a salir', async ({ page }) => {
  await page.goto(`/${VISITANTE}`);
  await bienvenida(page).getByRole('button', { name: 'Ahora no' }).click();
  await expect(bienvenida(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(bienvenida(page)).toHaveCount(0);

  await page.evaluate(() => localStorage.clear());
  await page.goto(`/panel${VISITANTE}`);
  await expect(bienvenida(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bienvenida(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(bienvenida(page)).toHaveCount(0);
});

test('D-041: con sesión no hay bienvenida, y la guía se abre desde Cuenta', async ({ page }) => {
  await page.goto('/cuenta?demo=en-linea');
  await expect(page.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeVisible();
  await expect(bienvenida(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Ver la guía' }).click();
  await expect(page).toHaveURL(/\/guia\?demo=en-linea/);
  // El vecino de la demo ya tiene cuenta y vivienda: esos pasos salen hechos.
  await expect(page.getByText('Ya tienes cuenta')).toBeVisible();
  await expect(page.getByText(/^Tu sector: /)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reportar un corte' }).last()).toBeVisible();
});

test('CANON §8: axe sin violaciones graves ni críticas con la bienvenida abierta', async ({
  page,
}) => {
  await page.goto(`/${VISITANTE}`);
  await expect(bienvenida(page)).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).exclude('.leaflet-tile-pane').analyze();
  const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
