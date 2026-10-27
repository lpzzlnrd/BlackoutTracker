import 'fake-indexeddb/auto';
import { contratoColaAvisos } from '../../contratos/cola-avisos.contrato';
import { crearColaAvisosDexie } from './cola-avisos.dexie';

// Una base nueva por prueba, para que no se contaminen entre sí.
let n = 0;
contratoColaAvisos('Dexie', () => crearColaAvisosDexie(`prueba-${(n += 1)}`));
