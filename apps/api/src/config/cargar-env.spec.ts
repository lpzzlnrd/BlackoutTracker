import { cargarEnv, RUTAS_ENV } from './cargar-env';

// D-030: un solo `.env` en la raíz del monorepo. Se prueba qué archivo elige; que el entorno mande
// sobre el archivo lo garantiza `process.loadEnvFile` de Node.
describe('cargarEnv', () => {
  const nodeEnvOriginal = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
  });

  /** Un cargador falso que solo "encuentra" los archivos indicados. */
  const cargadorCon = (existentes: string[]) => {
    const intentos: string[] = [];
    const cargar = (ruta: string) => {
      intentos.push(ruta);
      if (!existentes.includes(ruta)) throw new Error('ENOENT');
    };
    return { cargar, intentos };
  };

  it('lee el .env de la raíz del monorepo si la app no tiene uno', () => {
    process.env.NODE_ENV = 'desarrollo';
    const { cargar, intentos } = cargadorCon(['../../.env']);
    expect(cargarEnv(cargar)).toBe('../../.env');
    expect(intentos).toEqual(RUTAS_ENV);
  });

  it('prefiere el .env propio de la app y no lee el de la raíz', () => {
    process.env.NODE_ENV = 'desarrollo';
    const { cargar, intentos } = cargadorCon(['.env', '../../.env']);
    expect(cargarEnv(cargar)).toBe('.env');
    expect(intentos).toEqual(['.env']);
  });

  it('sin ningún .env no falla: las variables vienen del entorno', () => {
    process.env.NODE_ENV = 'desarrollo';
    const { cargar } = cargadorCon([]);
    expect(cargarEnv(cargar)).toBeNull();
  });

  it('en los tests no lee ningún archivo', () => {
    process.env.NODE_ENV = 'test';
    const { cargar, intentos } = cargadorCon(['.env', '../../.env']);
    expect(cargarEnv(cargar)).toBeNull();
    expect(intentos).toEqual([]);
  });
});
