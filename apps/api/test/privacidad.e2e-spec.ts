import { randomUUID } from 'node:crypto';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { Contexto } from './contexto';

/**
 * Barrido de privacidad (T-016, NF-06): ninguna respuesta de la API, ni de éxito ni de error,
 * contiene la ubicación de un residente. Se comprueba de tres formas:
 *   1. Por claves: ninguna propiedad del JSON se llama `ubicacion`, `coordenadas`, `lat`, `lng`…
 *   2. Por valor: el texto de la respuesta no contiene las coordenadas sembradas ni las del pin
 *      que se envía al registrarse (la API no las devuelve ni siquiera de vuelta).
 *   3. Por contrato: los esquemas de respuesta de Swagger no declaran esas propiedades.
 * Además, el test falla si aparece una ruta nueva que no esté en `CASOS`: se amplía en cada fase.
 */

// Sector 1 (noroeste) y sector 4 (sureste) de test/fixtures/puntos.ts, con decimales poco comunes
// para que no se confundan con otro número de la respuesta.
const A = { lat: 10.20751234, lng: -68.00912345 };
const B = { lat: 10.20253579, lng: -68.00302468 };
// El pin que envía quien se registra durante el barrido (sector 2, noreste).
const PIN = { lat: 10.20746421, lng: -68.00387654 };
// Un pin fuera de Guaparo, para el error 422 (la API no debe repetirlo en el mensaje).
const PIN_FUERA = { lat: 10.31415926, lng: -68.27182818 };

/** Fragmentos que delatarían una coordenada: se omite el signo y se corta a 6 decimales. */
const huellas = (p: { lat: number; lng: number }) =>
  [p.lat, p.lng].map((n) => String(Math.abs(n)).slice(0, 9));
const HUELLAS = [A, B, PIN, PIN_FUERA].flatMap(huellas);

const CLAVE_PROHIBIDA =
  /^(ubicacion|ubicación|coordenadas?|coordinates|geom|geometry|location|lat|lng|lon|latitud|longitud|latitude|longitude)$/i;

/** Rutas (JSON path) de las propiedades con nombre de ubicación, a cualquier profundidad. */
export function clavesProhibidas(valor: unknown, ruta = '$'): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => clavesProhibidas(v, `${ruta}[${i}]`));
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [
      ...(CLAVE_PROHIBIDA.test(k) ? [`${ruta}.${k}`] : []),
      ...clavesProhibidas(v, `${ruta}.${k}`),
    ]);
  }
  return [];
}

/** Fragmentos de coordenadas sembradas que aparecen en el texto de la respuesta. */
export function coordenadasFiltradas(valor: unknown): string[] {
  const texto = JSON.stringify(valor) ?? '';
  return HUELLAS.filter((h) => texto.includes(h));
}

type Metodo = 'get' | 'post' | 'put' | 'patch';

describe('Barrido de privacidad (NF-06, T-016)', () => {
  let ctx: Contexto;
  let n = 0;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const llamar = (metodo: Metodo, ruta: string, token?: string, cuerpo?: object) => {
    n += 1;
    const r = request(ctx.app.getHttpServer())
      [metodo](ruta)
      .set('X-Forwarded-For', `10.9.${Math.floor(n / 250)}.${n % 250}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return cuerpo ? r.send(cuerpo) : r;
  };

  /** Crea un residente con una ubicación concreta y distinguible en la base. */
  const sembrar = async (p: { lat: number; lng: number }, sectorId: number) => {
    const id = randomUUID();
    await ctx.bd.sql`
      insert into residentes (id, sector_id, ubicacion)
      values (${id}, ${sectorId}, st_setsrid(st_makepoint(${p.lng}, ${p.lat}), 4326))`;
    return { id, token: await ctx.emisor.firmar({ sub: id }) };
  };

  interface Caso {
    /** Ruta tal como la publica Swagger: `GET /api/reportes/{id}/cierre`. */
    swagger: string;
    estado: number;
    llamada: () => request.Test;
  }

  /**
   * Un caso por cada operación publicada, más los errores que podrían repetir datos del cuerpo.
   * Cuando llega una ruta nueva se agrega aquí: el test «cubre todas las rutas» falla hasta que
   * se haga (T-051 sumó `/sectores`, `/sectores/:id/historial` y `/estimaciones`; T-043, `/resumen`).
   */
  const casos = async (): Promise<Caso[]> => {
    const a = await sembrar(A, 1);
    const b = await sembrar(B, 4);
    const nuevo = randomUUID();
    const tokenNuevo = await ctx.emisor.firmar({ sub: nuevo });
    const idA = randomUUID();
    const idB = randomUUID();
    // Reportes de ambos residentes, uno abierto y otro cerrado, para que `mios` y el cierre tengan datos.
    await ctx.put(idA, a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-90) }).expect(200);
    await ctx
      .put(idB, b.token, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-60) })
      .expect(200);
    await ctx.patch(idB, b.token, { ocurridoEn: ctx.hace(-30) }).expect(200);

    return [
      { swagger: 'GET /api/salud', estado: 200, llamada: () => llamar('get', '/api/salud') },
      {
        swagger: 'POST /api/registro/validar-pin',
        estado: 200,
        llamada: () => llamar('post', '/api/registro/validar-pin', undefined, PIN),
      },
      {
        swagger: 'POST /api/residentes/me',
        estado: 201,
        llamada: () => llamar('post', '/api/residentes/me', tokenNuevo, PIN),
      },
      {
        swagger: 'GET /api/residentes/me',
        estado: 200,
        llamada: () => llamar('get', '/api/residentes/me', a.token),
      },
      {
        swagger: 'PUT /api/reportes/{id}',
        estado: 200,
        llamada: () =>
          llamar('put', `/api/reportes/${idA}`, a.token, {
            tipoServicio: 'agua',
            ocurridoEn: ctx.hace(-90),
          }),
      },
      {
        swagger: 'PATCH /api/reportes/{id}/cierre',
        estado: 200,
        llamada: () =>
          llamar('patch', `/api/reportes/${idA}/cierre`, a.token, { ocurridoEn: ctx.hace(-20) }),
      },
      {
        swagger: 'GET /api/reportes/mios',
        estado: 200,
        llamada: () => llamar('get', '/api/reportes/mios', a.token),
      },
      {
        swagger: 'GET /api/sectores',
        estado: 200,
        llamada: () => llamar('get', '/api/sectores', a.token),
      },
      // Historial, estimación y resumen son públicos (D-029): se barren sin token, como los ve
      // cualquiera que abra la app.
      {
        swagger: 'GET /api/sectores/{id}/historial',
        estado: 200,
        llamada: () => llamar('get', '/api/sectores/4/historial'),
      },
      {
        swagger: 'GET /api/estimaciones',
        estado: 200,
        llamada: () => llamar('get', '/api/estimaciones?sectorId=1&tipoServicio=agua'),
      },
      {
        swagger: 'GET /api/sectores/{id}/resumen',
        estado: 200,
        llamada: () => llamar('get', '/api/sectores/1/resumen'),
      },
    ];
  };

  /**
   * `GET /sectores` devuelve los polígonos de los sectores en GeoJSON: son límites públicos de la
   * urbanización, no ubicaciones de residentes (D-005). Solo esas claves quedan exentas; el chequeo
   * por valor (las coordenadas de los residentes) sigue aplicándose a toda la respuesta.
   */
  const POLIGONO_DE_SECTOR = /^\$\.features\[\d+\]\.geometry(\.coordinates)?$/;
  const SCHEMA_DE_SECTOR = /^GET \/api\/sectores 200: SectoresGeoJsonRespuesta\.SectorFeature\./;
  const clavesDe = (caso: string, cuerpo: unknown) =>
    clavesProhibidas(cuerpo).filter(
      (c) => !(caso === 'GET /api/sectores' && POLIGONO_DE_SECTOR.test(c)),
    );

  const documento = (): OpenAPIObject =>
    SwaggerModule.createDocument(ctx.app, new DocumentBuilder().build());

  it('NF-06: ninguna respuesta de éxito trae claves de ubicación ni las coordenadas sembradas', async () => {
    for (const caso of await casos()) {
      const res = await caso.llamada();
      expect({ caso: caso.swagger, estado: res.status }).toEqual({
        caso: caso.swagger,
        estado: caso.estado,
      });
      expect({ caso: caso.swagger, claves: clavesDe(caso.swagger, res.body) }).toEqual({
        caso: caso.swagger,
        claves: [],
      });
      expect({ caso: caso.swagger, coordenadas: coordenadasFiltradas(res.body) }).toEqual({
        caso: caso.swagger,
        coordenadas: [],
      });
    }
  });

  it('NF-06: los errores tampoco repiten el pin ni exponen la ubicación', async () => {
    const a = await sembrar(A, 1);
    const sinPerfil = await ctx.emisor.firmar({ sub: randomUUID() });
    const errores: Array<[string, number, () => request.Test]> = [
      [
        '422 pin fuera de Guaparo',
        422,
        () => llamar('post', '/api/registro/validar-pin', undefined, PIN_FUERA),
      ],
      [
        '422 registro con pin fuera',
        422,
        () => llamar('post', '/api/residentes/me', sinPerfil, PIN_FUERA),
      ],
      ['409 ya registrado', 409, () => llamar('post', '/api/residentes/me', a.token, PIN)],
      [
        '400 cuerpo con lat/lng de más',
        400,
        () =>
          llamar('put', `/api/reportes/${randomUUID()}`, a.token, {
            ...A,
            tipoServicio: 'agua',
            ocurridoEn: ctx.hace(-5),
          }),
      ],
      [
        '400 id no es UUID',
        400,
        () =>
          llamar('put', '/api/reportes/xyz', a.token, {
            tipoServicio: 'agua',
            ocurridoEn: ctx.hace(-5),
          }),
      ],
      [
        '400 pin con texto',
        400,
        () => llamar('post', '/api/registro/validar-pin', undefined, { lat: 'x', lng: A.lng }),
      ],
      ['403 sin registro', 403, () => llamar('get', '/api/residentes/me', sinPerfil)],
      [
        '404 cierre sin inicio',
        404,
        () =>
          llamar('patch', `/api/reportes/${randomUUID()}/cierre`, a.token, {
            ocurridoEn: ctx.hace(-5),
          }),
      ],
      [
        '404 resumen de un sector inexistente',
        404,
        () => llamar('get', '/api/sectores/999/resumen', a.token),
      ],
      [
        '404 historial de un sector inexistente',
        404,
        () => llamar('get', '/api/sectores/999/historial', a.token),
      ],
      [
        '400 estimación con servicio inválido',
        400,
        () => llamar('get', '/api/estimaciones?sectorId=1&tipoServicio=gas', a.token),
      ],
      ['401 sin token', 401, () => llamar('get', '/api/residentes/me')],
      ['404 ruta inexistente', 404, () => llamar('get', '/api/residentes')],
    ];
    for (const [nombre, estado, llamada] of errores) {
      const res = await llamada();
      expect({ nombre, estado: res.status }).toEqual({ nombre, estado });
      expect({ nombre, claves: clavesProhibidas(res.body) }).toEqual({ nombre, claves: [] });
      expect({ nombre, coordenadas: coordenadasFiltradas(res.body) }).toEqual({
        nombre,
        coordenadas: [],
      });
    }
  });

  it('NF-06: cubre todas las rutas publicadas en Swagger (se amplía en cada fase)', async () => {
    const publicadas = Object.entries(documento().paths).flatMap(([ruta, item]) =>
      (['get', 'post', 'put', 'patch', 'delete'] as const)
        .filter((m) => item[m])
        .map((m) => `${m.toUpperCase()} ${ruta}`),
    );
    const cubiertas = (await casos()).map((c) => c.swagger);
    expect({ sinCubrir: publicadas.filter((r) => !cubiertas.includes(r)) }).toEqual({
      sinCubrir: [],
    });
    expect({ sobran: cubiertas.filter((r) => !publicadas.includes(r)) }).toEqual({ sobran: [] });
  });

  it('NF-06: los esquemas de respuesta de Swagger no declaran propiedades de ubicación', () => {
    const doc = documento();
    const esquemas = doc.components?.schemas ?? {};
    const vistos = new Set<string>();
    const propiedadesDe = (nodo: unknown): string[] => {
      if (!nodo || typeof nodo !== 'object') return [];
      const o = nodo as Record<string, unknown>;
      const ref = typeof o.$ref === 'string' ? o.$ref.split('/').pop() : undefined;
      if (ref) {
        if (vistos.has(ref)) return [];
        vistos.add(ref);
        return propiedadesDe(esquemas[ref]).map((p) => `${ref}.${p}`);
      }
      const propias = Object.keys((o.properties as object | undefined) ?? {}).filter((k) =>
        CLAVE_PROHIBIDA.test(k),
      );
      const hijos = [
        ...Object.values((o.properties as Record<string, unknown> | undefined) ?? {}),
        o.items,
        ...((o.allOf as unknown[] | undefined) ?? []),
        ...((o.oneOf as unknown[] | undefined) ?? []),
        ...((o.anyOf as unknown[] | undefined) ?? []),
      ].flatMap(propiedadesDe);
      return [...propias, ...hijos];
    };

    const infracciones: string[] = [];
    for (const [ruta, item] of Object.entries(doc.paths)) {
      for (const metodo of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const operacion = item[metodo];
        if (!operacion) continue;
        for (const [estado, respuesta] of Object.entries(operacion.responses ?? {})) {
          const contenido = (respuesta as { content?: Record<string, { schema?: unknown }> })
            .content;
          for (const medio of Object.values(contenido ?? {})) {
            vistos.clear();
            for (const p of propiedadesDe(medio.schema)) {
              const infraccion = `${metodo.toUpperCase()} ${ruta} ${estado}: ${p}`;
              if (!SCHEMA_DE_SECTOR.test(infraccion)) infracciones.push(infraccion);
            }
          }
        }
      }
    }
    expect(infracciones).toEqual([]);
  });

  it('NF-06: el detector funciona (una fuga plantada sí se detecta)', () => {
    expect(clavesProhibidas({ sector: 1, ubicacion: { lat: 1 } })).toEqual([
      '$.ubicacion',
      '$.ubicacion.lat',
    ]);
    expect(clavesProhibidas([{ geom: 1 }, { ok: 1 }])).toEqual(['$[0].geom']);
    expect(clavesProhibidas({ sectorId: 1, sectorNombre: 'Noroeste' })).toEqual([]);
    expect(coordenadasFiltradas({ texto: `POINT(${A.lng} ${A.lat})` })).toEqual([
      '10.207512',
      '68.009123',
    ]);
    expect(coordenadasFiltradas({ sectorId: 1 })).toEqual([]);
  });
});
