import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// El recorrido guiado (T-073, D-043): desde "Empezar" en la bienvenida, sobre las pantallas
// reales de la demo sin sesión (`&vecino=visitante`). Cada prueba arranca con el almacenamiento
// vacío.

const VISITANTE = '?demo=en-linea&vecino=visitante';

const tarjeta = (page: Page) => page.getByRole('region', { name: 'Recorrido guiado' });
const continuar = (page: Page) => tarjeta(page).getByRole('button', { name: 'Continuar' }).click();
const indicacion = (page: Page, titulo: string) =>
  expect(tarjeta(page).getByRole('heading', { name: titulo })).toBeVisible();

async function empezar(page: Page) {
  await page.goto(`/${VISITANTE}`);
  await page
    .getByRole('dialog', { name: '¿Nuevo en BlackoutTracker?' })
    .getByRole('button', { name: 'Empezar' })
    .click();
  await expect(page).toHaveURL(/\/entrar\?.*modo=crear/);
  await indicacion(page, 'Escribe tu correo');
}

async function crearCuenta(page: Page) {
  await page.getByLabel('Correo').fill('nuevo@demo.test');
  // "Continuar" se activa cuando el correo es válido; Intro hace lo mismo.
  await page.keyboard.press('Enter');
  await indicacion(page, 'Inventa una contraseña');
  await expect(tarjeta(page).getByRole('button', { name: 'Continuar' })).toBeDisabled();
  await page.getByLabel('Contraseña').fill('secreta1');
  await continuar(page);
  await indicacion(page, 'Toca «Crear cuenta»');
  await page.locator('main').getByRole('button', { name: 'Crear cuenta' }).click();
  await indicacion(page, 'Cuenta creada');
  await continuar(page);
}

test('D-043: el recorrido completo, de crear la cuenta al final, sin enviar ningún aviso', async ({
  page,
}) => {
  await empezar(page);
  await crearCuenta(page);

  // 1b. Así se entra la próxima vez: señala Cuenta en la navegación.
  await expect(page).toHaveURL(/\/cuenta/);
  await indicacion(page, 'Así entras la próxima vez');
  await continuar(page);

  // 2. La vivienda: la tarjeta sigue a la pantalla del registro.
  await expect(page).toHaveURL(/\/registro/);
  await indicacion(page, 'Toca tu casa en el mapa');
  const mapa = await page.locator('[data-guia="mapa-vivienda"]').boundingBox();
  if (!mapa) throw new Error('No se ve el mapa del registro.');
  await page.mouse.click(mapa.x + mapa.width / 2, mapa.y + mapa.height / 2);
  await indicacion(page, 'Toca «Continuar»');
  await page.locator('main').getByRole('button', { name: 'Continuar' }).click();
  await indicacion(page, 'Confirma tu sector');
  await page.getByRole('button', { name: 'Confirmar mi vivienda' }).click();
  await indicacion(page, 'Vivienda marcada');
  await continuar(page);

  // 3. El mapa.
  await expect(page).toHaveURL(/\/\?demo=/);
  await indicacion(page, 'Elige Luz o Agua');
  await page.locator('[data-guia="selector-servicio"]').getByRole('button').last().click();
  await indicacion(page, 'Qué dice cada color');
  await continuar(page);
  await indicacion(page, 'Así está tu sector');
  await continuar(page);

  // 4. Avisar es una práctica: el toque no guarda nada.
  await expect(page).toHaveURL(/\/reportar/);
  await indicacion(page, 'Elige qué se fue');
  await page.locator('[data-guia="tarjetas-servicio"] button').first().click();
  await indicacion(page, '¿Cuándo pasó?');
  await continuar(page);
  await indicacion(page, 'Toca para avisar');
  await page.locator('[data-guia="boton-avisar"]').click();
  await indicacion(page, 'Así se avisa');
  await expect(page.getByText('Aviso guardado')).toHaveCount(0);
  await continuar(page);

  // 5 a 7.
  await indicacion(page, 'Un aviso solo no cambia el mapa');
  await continuar(page);
  await expect(page).toHaveURL(/\/\?demo=/);
  await indicacion(page, 'Cuánto suele durar un corte');
  await continuar(page);
  await expect(page).toHaveURL(/\/avisos/);
  await indicacion(page, 'Sin señal también puedes avisar');
  await expect(page.locator('main').getByText('Se fue la luz')).toHaveCount(0);
  await continuar(page);

  await expect(page.getByRole('heading', { name: 'Terminaste el recorrido' })).toBeVisible();
  await expect(page.locator('ol > li')).toHaveCount(7);
  await page.getByRole('button', { name: 'Ir al mapa' }).click();
  await expect(tarjeta(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('recorrido'))).toBeNull();
});

test('D-043: el velo solo deja usar lo señalado', async ({ page }) => {
  await empezar(page);
  const enlace = page.locator('[data-guia="nav-mapa"]:visible');
  const caja = await enlace.boundingBox();
  if (!caja) throw new Error('No se ve la navegación.');
  // El toque cae en el velo, no en el enlace.
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(page).toHaveURL(/\/entrar/);
  // Lo iluminado sí se usa.
  await page.getByLabel('Correo').fill('nuevo@demo.test');
  await expect(tarjeta(page).getByRole('button', { name: 'Continuar' })).toBeEnabled();
});

test('D-043: sigue donde iba al volver a abrir la app', async ({ page }) => {
  await empezar(page);
  await page.getByLabel('Correo').fill('nuevo@demo.test');
  await continuar(page);
  await indicacion(page, 'Inventa una contraseña');
  // Vuelve a abrir la app en otra pantalla (la demo solo es visitante con `&vecino=visitante`).
  await page.goto(`/${VISITANTE}`);
  await expect(page.getByRole('dialog', { name: '¿Nuevo en BlackoutTracker?' })).toHaveCount(0);
  await indicacion(page, 'Seguimos donde ibas');
  await continuar(page);
  await expect(page).toHaveURL(/\/entrar\?.*modo=crear/);
  await indicacion(page, 'Inventa una contraseña');
  // "Atrás" vuelve a la indicación anterior.
  await tarjeta(page).getByRole('button', { name: 'Atrás' }).click();
  await indicacion(page, 'Escribe tu correo');
});

test('D-043: "Saltar" termina el recorrido y no vuelve a salir', async ({ page }) => {
  await empezar(page);
  await tarjeta(page).getByRole('button', { name: 'Saltar' }).click();
  await expect(tarjeta(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(tarjeta(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '¿Nuevo en BlackoutTracker?' })).toHaveCount(0);
});

test('D-043: se repite desde Cuenta y salta lo que el vecino ya hizo', async ({ page }) => {
  // El vecino de la demo ya tiene cuenta y vivienda: empieza en el mapa.
  await page.goto('/cuenta?demo=en-linea');
  await page.getByRole('button', { name: 'Hacer el recorrido' }).click();
  await expect(page).toHaveURL(/\/\?demo=en-linea/);
  await indicacion(page, 'Elige Luz o Agua');
  await expect(tarjeta(page).getByText(/Paso 3 de 7/)).toBeVisible();
});

test('CANON §8: axe sin violaciones graves ni críticas con el recorrido abierto', async ({
  page,
}) => {
  await empezar(page);
  const { violations } = await new AxeBuilder({ page }).exclude('.leaflet-tile-pane').analyze();
  const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
