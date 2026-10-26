import { contratoColaAvisos } from '../../contratos/cola-avisos.contrato';
import { crearColaAvisosMock } from './cola-avisos.mock';

contratoColaAvisos('mock', () => crearColaAvisosMock());
