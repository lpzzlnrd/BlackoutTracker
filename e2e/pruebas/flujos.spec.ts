import { expect, test, type Page } from '@playwright/test';

// Flujos completos con los datos de ejemplo: lo que hace un vecino, de principio a fin. La demo
// arranca con sesión y perfil, así que Reportar se abre directo.

const navPrincipal = (page: Page) =>
  page.getByRole('navigation', { name: 'Principal' }).locator('visible=true');

test('REP-01: avisar que se fue el agua deja el aviso enviado en "Tus avisos"', async ({
  page,
}) => {
  await page.goto('/reportar?demo=en-linea');
  await page.getByRole('group', { name: 'Servicio' }).getByRole('button', { name: 'Agua' }).click();
  await page.getByRole('button', { name: 'Se fue el agua' }).click();

  await expect(page.getByText('Aviso guardado')).toBeVisible();
  // REP-05: con el corte propio abierto, el botón pasa a cerrarlo.
  await expect(page.getByRole('button', { name: 'Ya volvió el agua' })).toBeVisible();
  // La cola vive en su propia pantalla (D-037).
  await page.getByRole('link', { name: 'Ver tus avisos' }).click();
  await expect(page).toHaveURL(/\/avisos\?demo=en-linea/);
  const cola = page.locator('#cola');
  await expect(cola.getByText('Se fue el agua').first()).toBeVisible();
  await expect(cola.getByText('Enviado').first()).toBeVisible();
});

test('OFF-01: sin conexión el aviso queda pendiente y se enviará al reconectar', async ({
  page,
}) => {
  await page.goto('/reportar?demo=sin-conexion');
  await page.getByRole('group', { name: 'Servicio' }).getByRole('button', { name: 'Agua' }).click();
  await page.getByRole('button', { name: 'Se fue el agua' }).click();

  await expect(page.getByText('Se enviará al reconectar.')).toBeVisible();
  // El de la demo y este: la barra los cuenta y Avisos los muestra pendientes.
  await navPrincipal(page)
    .getByRole('link', { name: /Avisos.*2 avisos sin enviar/ })
    .click();
  await expect(page.locator('#cola').getByText('Pendiente').first()).toBeVisible();
});

test('VIS-02: el filtro Agua del panel cambia la tabla de sectores', async ({ page }) => {
  await page.goto('/panel?demo=en-linea');
  await expect(page.getByText('Sectores · Luz')).toBeVisible();
  const agua = page.getByRole('group', { name: 'Servicio' }).getByRole('button', { name: 'Agua' });
  await agua.click();
  await expect(agua).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sectores · Agua')).toBeVisible();
});

test('VIS-04: el detalle de un sector muestra estado, estimación y últimos cortes', async ({
  page,
}) => {
  await page.goto('/panel?demo=en-linea&sector=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Sector 1' })).toBeVisible();
  await expect(page.getByText('Estimación estadística').first()).toBeVisible();
  await expect(page.getByText(/aprox\. \d/).first()).toBeVisible();
  await expect(page.getByText('Últimos cortes').first()).toBeVisible();
  await page.getByRole('link', { name: 'Volver al panel' }).click();
  await expect(page).toHaveURL(/\/panel\?demo=en-linea$/);
});

test('EST-04: con pocos cortes se muestra "Datos insuficientes" y no una cifra', async ({
  page,
}) => {
  await page.goto('/panel?demo=en-linea&sector=3');
  await expect(page.getByText('Datos insuficientes').first()).toBeVisible();
});
