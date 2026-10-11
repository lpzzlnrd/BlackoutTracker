import { migrar } from '../src/db/migrar';
import { URL_BD_TEST } from './entorno';

/** Aplica las migraciones a `blackout_test` una vez antes de todas las suites. */
export default async function globalSetup(): Promise<void> {
  await migrar(URL_BD_TEST);
}
