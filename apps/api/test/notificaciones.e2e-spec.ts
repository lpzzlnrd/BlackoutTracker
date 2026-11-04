import { randomUUID } from 'node:crypto';
import { ConsensoService } from '../src/consenso/consenso.service';
import { EnvioService } from '../src/notificaciones/envio.service';
import { RecordatoriosService } from '../src/notificaciones/recordatorios.service';
import { Contexto, type ResidentePrueba } from './contexto';

/** Una hora de Caracas (UTC−4). */
const caracas = (hhmm: string, dia = '2026-11-03') => new Date(`${dia}T${hhmm}:00-04:00`);
/** Lo mismo en ISO, para el SQL a mano de los tests. */
const iso = (hhmm: string, dia = '2026-11-03') => caracas(hhmm, dia).toISOString();
/** Claves con la forma de las de un navegador (65 y 16 bytes en base64url). */
const P256DH = `B${'A'.repeat(86)}`;
const AUTH = 'Q'.repeat(22);

describe('Notificaciones push (T-072, D-042)', () => {
  let ctx: Contexto;
  let envio: EnvioService;
  let recordatorios: RecordatoriosService;
  let consenso: ConsensoService;

  beforeAll(async () => {
    ctx = await Contexto.crear();
    envio = ctx.app.get(EnvioService);
    recordatorios = ctx.app.get(RecordatoriosService);
    consenso = ctx.app.get(ConsensoService);
  });
  afterAll(() => ctx.cerrar());
  beforeEach(async () => {
    await ctx.reiniciar();
    ctx.ahora = caracas('14:30');
  });

  const endpointDe = (r: ResidentePrueba) => `https://fcm.googleapis.com/fcm/send/${r.id}`;

  /** Un vecino del sector con el teléfono suscrito. */
  const vecino = async (sectorId = 1, { suscrito = true } = {}): Promise<ResidentePrueba> => {
    const r = await ctx.residente(sectorId);
    if (suscrito) {
      await ctx
        .pedir('put', '/api/notificaciones/suscripcion', r.token, {
          endpoint: endpointDe(r),
          claves: { p256dh: P256DH, auth: AUTH },
        })
        .expect(204);
    }
    return r;
  };
  const vecinos = (n: number, sectorId = 1) =>
    Promise.all(Array.from({ length: n }, () => vecino(sectorId)));

  const iniciar = async (r: ResidentePrueba, tipo: string, minutos: number) => {
    const id = randomUUID();
    await ctx.put(id, r.token, { tipoServicio: tipo, ocurridoEn: ctx.hace(minutos) }).expect(200);
    return id;
  };
  const cerrar = (r: ResidentePrueba, id: string, minutos: number) =>
    ctx.patch(id, r.token, { ocurridoEn: ctx.hace(minutos) }).expect(200);

  const filas = (tipo?: string) =>
    tipo
      ? ctx.bd
          .sql`select * from notificaciones where tipo = ${tipo} order by creada_en, residente_id`
      : ctx.bd.sql`select * from notificaciones order by creada_en, residente_id`;
  const enviadosA = (r: ResidentePrueba) =>
    ctx.push.enviados.filter((e) => e.endpoint === endpointDe(r)).map((e) => e.mensaje);

  /** Tres vecinos confirman un corte; devuelve sus reportes. */
  const confirmarCorte = async (rs: ResidentePrueba[], tipo = 'electricidad') => {
    const ids: string[] = [];
    for (const [i, r] of rs.entries()) ids.push(await iniciar(r, tipo, -10 + i));
    return ids;
  };

  describe('suscripción y preferencias', () => {
    it('NOT-18: la clave pública VAPID es pública', async () => {
      const res = await ctx.pedir('get', '/api/notificaciones/clave').expect(200);
      expect(res.body).toEqual({ activo: true, clavePublica: process.env.VAPID_PUBLIC_KEY });
    });

    it('NOT-13: solo se aceptan servicios push de navegadores (anti-SSRF)', async () => {
      const r = await ctx.residente(1);
      for (const endpoint of [
        'https://blackouttracker.onrender.com/api/salud',
        'https://169.254.169.254/latest/meta-data',
        'http://fcm.googleapis.com/fcm/send/x',
      ]) {
        const res = await ctx
          .pedir('put', '/api/notificaciones/suscripcion', r.token, {
            endpoint,
            claves: { p256dh: P256DH, auth: AUTH },
          })
          .expect(400);
        expect(res.body.codigo).toBe('DATOS_INVALIDOS');
      }
      expect(await ctx.bd.sql`select * from suscripciones_push`).toHaveLength(0);
    });

    it('NOT-19: suscribir es idempotente y el mismo teléfono pasa a la cuenta nueva', async () => {
      const a = await vecino();
      const b = await ctx.residente(2);
      await ctx
        .pedir('put', '/api/notificaciones/suscripcion', b.token, {
          endpoint: endpointDe(a),
          claves: { p256dh: P256DH, auth: AUTH },
        })
        .expect(204);
      const subs = await ctx.bd.sql`select residente_id from suscripciones_push`;
      expect(subs).toEqual([{ residente_id: b.id }]);
    });

    it('NOT-19: la baja solo borra el dispositivo propio', async () => {
      const a = await vecino();
      const b = await vecino();
      await ctx
        .pedir('delete', '/api/notificaciones/suscripcion', b.token, { endpoint: endpointDe(a) })
        .expect(204);
      expect(await ctx.bd.sql`select * from suscripciones_push`).toHaveLength(2);
      await ctx
        .pedir('delete', '/api/notificaciones/suscripcion', a.token, { endpoint: endpointDe(a) })
        .expect(204);
      expect(await ctx.bd.sql`select residente_id from suscripciones_push`).toEqual([
        { residente_id: b.id },
      ]);
    });

    it('NOT-24: recordatorios sí y agua de noche no, por defecto; se cambian por partes', async () => {
      const r = await vecino();
      const ruta = '/api/notificaciones/preferencias';
      expect((await ctx.pedir('get', ruta, r.token).expect(200)).body).toEqual({
        recordatorios: true,
        aguaDeNoche: false,
      });
      const res = await ctx.pedir('patch', ruta, r.token, { aguaDeNoche: true }).expect(200);
      expect(res.body).toEqual({ recordatorios: true, aguaDeNoche: true });
      await ctx.pedir('patch', ruta, r.token, { aguaDeNoche: 'sí' }).expect(400);
    });

    it('NOT-19: sin sesión no hay suscripción ni preferencias', async () => {
      await ctx.pedir('put', '/api/notificaciones/suscripcion').expect(401);
      await ctx.pedir('get', '/api/notificaciones/preferencias').expect(401);
    });
  });

  describe('avisos de corte', () => {
    it('NOT-01: al confirmarse un corte avisa a los vecinos suscritos del sector, y a nadie más', async () => {
      const [a, b, c] = await vecinos(3);
      const d = await vecino(1);
      await vecino(1, { suscrito: false });
      const otro = await vecino(2);
      await confirmarCorte([a, b, c]);

      const cortes = await filas('corte_confirmado');
      expect(cortes.map((f) => f.residente_id).sort()).toEqual([a.id, b.id, c.id, d.id].sort());
      const deD = cortes.find((f) => f.residente_id === d.id);
      expect(deD?.datos).toEqual({ vecinos: 3, aporto: false });
      expect(cortes.find((f) => f.residente_id === a.id)?.datos).toEqual({
        vecinos: 3,
        aporto: true,
      });

      expect(await envio.enviarPendientes()).toBe(4);
      const [mensaje] = enviadosA(d);
      expect(mensaje).toMatchObject({
        tipo: 'corte_confirmado',
        titulo: 'Se fue la luz en Noroeste',
        etiqueta: 'corte-1-electricidad',
        tipoServicio: 'electricidad',
        renotificar: true,
      });
      expect(mensaje.cuerpo).toMatch(/^Desde las 14:2\d, lo confirmaron 3 vecinos\. /);
      expect(mensaje.cuerpo).toContain('Todavía no hay datos suficientes');
      expect(mensaje.url).toBe(`/?n=${deD?.id}`);
      expect(mensaje.imagen).toMatch(
        /^https:\/\/api\.test\/api\/notificaciones\/imagen\/1\/electricidad\?v=\d+$/,
      );
      expect(enviadosA(a)[0].cuerpo).toContain('Tu reporte y el de 2 vecinos más lo confirmaron.');
      expect(enviadosA(otro)).toEqual([]);
      const op = ctx.push.enviados[0].opciones;
      expect(op).toEqual({ ttlSeg: 21_600, urgencia: 'high', tema: 'corte-1-electricidad' });
      expect((await filas('corte_confirmado')).every((f) => f.estado === 'enviada')).toBe(true);
    });

    it('NOT-02: con N + 1 reportes no se duplica el aviso', async () => {
      const [a, b, c, d] = await vecinos(4);
      await confirmarCorte([a, b, c]);
      await iniciar(d, 'electricidad', -5);
      expect(await filas('corte_confirmado')).toHaveLength(4);
    });

    it('NOT-03: el restablecimiento por consenso avisa «¡Volvió la luz!»', async () => {
      const rs = await vecinos(3);
      const ids = await confirmarCorte(rs);
      await envio.enviarPendientes();
      ctx.ahora = caracas('16:30');
      for (const [i, r] of rs.entries()) await cerrar(r, ids[i], -10 + i);

      const vueltas = await filas('servicio_restablecido');
      expect(vueltas).toHaveLength(3);
      expect(vueltas[0].datos).toEqual({ vecinos: 3, aporto: true });
      await envio.enviarPendientes();
      const [msg] = enviadosA(rs[0]).filter((m) => m.tipo === 'servicio_restablecido');
      expect(msg.titulo).toBe('¡Volvió la luz a Noroeste!');
      expect(msg.cuerpo).toMatch(
        /^Volvió a las 16:2\d, después de 2 h( \d+ min)?\. Gracias por avisar\.$/,
      );
      expect(msg.etiqueta).toBe('corte-1-electricidad');
    });

    it('NOT-03: un ciclo incompleto (todos los reportes vencieron) no avisa', async () => {
      await confirmarCorte(await vecinos(3));
      await envio.enviarPendientes();
      ctx.ahora = new Date(ctx.ahora.getTime() + 49 * 3_600_000);
      await consenso.reevaluarVencidos();
      expect((await ctx.bd.sql`select incompleto from eventos_sector`)[0].incompleto).toBe(true);
      expect(await filas('servicio_restablecido')).toHaveLength(0);
    });

    it('NOT-17: si el corte ya terminó al enviar, «se fue» se descarta y solo sale «volvió»', async () => {
      const rs = await vecinos(3);
      const ids = await confirmarCorte(rs);
      ctx.ahora = caracas('14:45');
      for (const [i, r] of rs.entries()) await cerrar(r, ids[i], -3 + i);

      await envio.enviarPendientes();
      expect(enviadosA(rs[0]).map((m) => m.tipo)).toEqual(['servicio_restablecido']);
      expect((await filas('corte_confirmado')).every((f) => f.estado === 'descartada')).toBe(true);
    });

    it('NOT-04: lo que se confirma a las 23:10 espera a las 07:00', async () => {
      ctx.ahora = caracas('23:10');
      const rs = await vecinos(3);
      await confirmarCorte(rs);
      const [f] = await filas('corte_confirmado');
      expect(new Date(f.programada_para)).toEqual(caracas('07:00', '2026-11-04'));

      ctx.ahora = caracas('23:15');
      expect(await envio.enviarPendientes()).toBe(0);
      ctx.ahora = caracas('07:01', '2026-11-04');
      expect(await envio.enviarPendientes()).toBe(3);
    });

    it('NOT-05: «llegó el agua» suena de noche solo a quien lo pidió', async () => {
      const rs = await vecinos(3);
      const nocturno = await vecino(1);
      const dormilon = await vecino(1);
      await ctx
        .pedir('patch', '/api/notificaciones/preferencias', nocturno.token, { aguaDeNoche: true })
        .expect(200);
      ctx.ahora = caracas('20:00');
      const ids = await confirmarCorte(rs, 'agua');
      await envio.enviarPendientes();
      ctx.push.reiniciar();

      ctx.ahora = caracas('23:30');
      for (const [i, r] of rs.entries()) await cerrar(r, ids[i], -10 + i);
      await envio.enviarPendientes();

      const [msg] = enviadosA(nocturno);
      expect(msg.titulo).toBe('Perdón la hora: ¡llegó el agua a Noroeste!');
      expect(msg.cuerpo).toMatch(/^Aprovecha y llena los tobos\. /);
      expect(enviadosA(dormilon)).toEqual([]);
      const [pendiente] = await ctx.bd.sql`
        select programada_para from notificaciones
        where residente_id = ${dormilon.id} and tipo = 'servicio_restablecido'`;
      expect(new Date(pendiente.programada_para)).toEqual(caracas('07:00', '2026-11-04'));
    });

    it('NOT-01: dice cuántos sectores vecinos están sin el servicio', async () => {
      await confirmarCorte(await vecinos(3, 2));
      await envio.enviarPendientes();
      const rs = await vecinos(3, 1);
      await confirmarCorte(rs);
      ctx.push.reiniciar();
      await envio.enviarPendientes();
      expect(enviadosA(rs[0])[0].cuerpo).toContain('También sin luz en 1 sector vecino.');
    });
  });

  describe('pregunta a los vecinos', () => {
    it('NOT-11: con el primer reporte sin confirmar pregunta, sin sugerir, a quien no reportó', async () => {
      const a = await vecino();
      const b = await vecino();
      const sinRecordatorios = await vecino();
      await ctx
        .pedir('patch', '/api/notificaciones/preferencias', sinRecordatorios.token, {
          recordatorios: false,
        })
        .expect(200);
      await iniciar(a, 'agua', -5);

      const preguntas = await filas('pregunta_vecinos');
      expect(preguntas.map((p) => p.residente_id)).toEqual([b.id]);
      await envio.enviarPendientes();
      const [msg] = enviadosA(b);
      expect(msg.titulo).toBe('¿Y el agua por tu casa?');
      expect(msg.acciones.map((x) => x.accion)).toEqual(['se-fue', 'aqui-si-hay']);
      expect(msg.url).toBe(`/reportar?servicio=agua&n=${preguntas[0].id}`);
      expect(ctx.push.enviados[0].opciones.urgencia).toBe('normal');

      // Un segundo reporte sin confirmar no vuelve a preguntar.
      await iniciar(b, 'agua', -4);
      expect(await filas('pregunta_vecinos')).toHaveLength(1);
    });

    it('NOT-11: si el corte se confirma antes de enviarla, la pregunta se descarta', async () => {
      const rs = await vecinos(4);
      await confirmarCorte(rs.slice(0, 3));
      await envio.enviarPendientes();
      expect(enviadosA(rs[3]).map((m) => m.tipo)).toEqual(['corte_confirmado']);
      const preguntas = await filas('pregunta_vecinos');
      expect(preguntas.length).toBeGreaterThan(0);
      expect(preguntas.every((p) => p.estado === 'descartada')).toBe(true);
    });
  });

  describe('recordatorios (ultimo_ingreso)', () => {
    /** Un corte de luz de 2 h, confirmado y cerrado hoy en el sector. */
    const corteDeHoy = (sectorId = 1) => ctx.bd.sql`
      insert into eventos_sector (sector_id, tipo_servicio, inicio_en, fin_en, confirmado_en, restablecido_en)
      values (${sectorId}, 'electricidad', ${iso('09:00')}, ${iso('11:00')}, ${iso('09:10')}, ${iso('11:05')})`;

    it('NOT-06: GET /residentes/me anota la entrada, a lo sumo cada 15 min', async () => {
      const r = await vecino();
      const ultimo = async () =>
        (await ctx.bd.sql`select ultimo_ingreso from residentes where id = ${r.id}`)[0]
          .ultimo_ingreso as string | null;
      expect(await ultimo()).toBeNull();
      await ctx.get('/api/residentes/me', r.token).expect(200);
      expect(new Date(String(await ultimo()))).toEqual(caracas('14:30'));
      ctx.ahora = caracas('14:40');
      await ctx.get('/api/residentes/me', r.token).expect(200);
      expect(new Date(String(await ultimo()))).toEqual(caracas('14:30'));
      ctx.ahora = caracas('14:50');
      await ctx.get('/api/residentes/me', r.token).expect(200);
      expect(new Date(String(await ultimo()))).toEqual(caracas('14:50'));
    });

    it('NOT-06: a las 19:00, resumen del día solo a quien no entró hoy', async () => {
      const entro = await vecino();
      const noEntro = await vecino();
      await ctx.get('/api/residentes/me', entro.token).expect(200);
      await corteDeHoy();

      ctx.ahora = caracas('18:50');
      expect(await recordatorios.programar()).toBe(0);
      ctx.ahora = caracas('19:05');
      expect(await recordatorios.programar()).toBe(1);
      await envio.enviarPendientes();
      expect(enviadosA(entro)).toEqual([]);
      const [msg] = enviadosA(noEntro);
      expect(msg.titulo).toBe('Hoy en Noroeste');
      expect(msg.cuerpo).toBe('La luz se fue 1 vez (2 h en total). Échale un ojo al mapa.');
      expect(msg.url).toMatch(/^\/panel\?n=/);
    });

    it('NOT-07: si no hay nada útil que contar, no se envía nada', async () => {
      await vecino();
      ctx.ahora = caracas('19:05');
      expect(await recordatorios.programar()).toBe(0);
    });

    it('NOT-08: a lo sumo un recordatorio al día (una franja)', async () => {
      const r = await vecino();
      await corteDeHoy();
      ctx.ahora = caracas('19:05');
      expect(await recordatorios.programar()).toBe(1);
      await envio.enviarPendientes();
      ctx.ahora = caracas('19:15');
      expect(await recordatorios.programar()).toBe(0);

      // Una pregunta que llega después también respeta el tope.
      const otro = await vecino();
      ctx.ahora = caracas('19:40');
      await iniciar(otro, 'agua', -2);
      await envio.enviarPendientes();
      expect(enviadosA(r).map((m) => m.tipo)).toEqual(['resumen_dia']);
      const [pregunta] = await ctx.bd.sql`
        select estado from notificaciones where residente_id = ${r.id} and tipo = 'pregunta_vecinos'`;
      expect(pregunta.estado).toBe('descartada');
    });

    it('NOT-09: tras 3 recordatorios sin abrir, pausa de una semana', async () => {
      const r = await vecino();
      await corteDeHoy();
      for (const dias of [1, 2, 3]) {
        const t = new Date(caracas('19:05').getTime() - dias * 86_400_000).toISOString();
        await ctx.bd.sql`
          insert into notificaciones (residente_id, tipo, sector_id, estado, creada_en, programada_para, enviada_en)
          values (${r.id}, 'resumen_dia', 1, 'enviada', ${t}, ${t}, ${t})`;
      }
      ctx.ahora = caracas('19:05');
      expect(await recordatorios.programar()).toBe(0);

      // Con que haya abierto uno, sigue normal.
      await ctx.bd
        .sql`update notificaciones set abierta_en = enviada_en where residente_id = ${r.id}
                       and enviada_en = (select max(enviada_en) from notificaciones where residente_id = ${r.id})`;
      expect(await recordatorios.programar()).toBe(1);
    });

    it('NOT-10: «¿ya volvió?» cuando el reporte pasa el umbral, una sola vez', async () => {
      const r = await vecino();
      ctx.ahora = caracas('19:05');
      await iniciar(r, 'electricidad', -13 * 60);
      expect(await recordatorios.programar()).toBe(1);
      await envio.enviarPendientes();
      const [msg] = enviadosA(r);
      expect(msg.titulo).toBe('Oye, ¿ya volvió la luz?');
      expect(msg.cuerpo).toMatch(/^Tu reporte sigue abierto desde las 06:05\./);

      ctx.ahora = caracas('19:05', '2026-11-04');
      expect(await recordatorios.programar()).toBe(0);
    });

    it('NOT-24: con los recordatorios apagados no recibe ninguno', async () => {
      const r = await vecino();
      await ctx
        .pedir('patch', '/api/notificaciones/preferencias', r.token, { recordatorios: false })
        .expect(200);
      await corteDeHoy();
      ctx.ahora = caracas('19:05');
      expect(await recordatorios.programar()).toBe(0);
    });
  });

  describe('envío', () => {
    it('NOT-14: una suscripción caducada (410) se borra', async () => {
      const rs = await vecinos(3);
      const d = await vecino();
      ctx.push.respuestas.set(endpointDe(d), 'caducada');
      await confirmarCorte(rs);
      await envio.enviarPendientes();
      expect(
        await ctx.bd.sql`select * from suscripciones_push where residente_id = ${d.id}`,
      ).toHaveLength(0);
      const [f] = await ctx.bd.sql`
        select estado from notificaciones where residente_id = ${d.id} and tipo = 'corte_confirmado'`;
      expect(f.estado).toBe('descartada');
    });

    it('sin claves VAPID (transporte inactivo) no envía nada y no pierde lo pendiente', async () => {
      await confirmarCorte(await vecinos(3));
      ctx.push.activo = false;
      expect(await envio.enviarPendientes()).toBe(0);
      expect((await filas('corte_confirmado')).every((f) => f.estado === 'pendiente')).toBe(true);
    });

    it('lo que espera más de 12 h ya no se envía', async () => {
      await confirmarCorte(await vecinos(3));
      // Un día después, fuera de las horas silenciosas (así no se aplaza en vez de descartarse).
      ctx.ahora = caracas('16:30', '2026-11-04');
      expect(await envio.enviarPendientes()).toBe(0);
      expect((await filas('corte_confirmado')).every((f) => f.estado === 'descartada')).toBe(true);
    });

    it('NOT-16: abrir la notificación la marca, solo si es propia', async () => {
      const rs = await vecinos(3);
      await confirmarCorte(rs);
      await envio.enviarPendientes();
      const [f] = await ctx.bd.sql`
        select id from notificaciones where residente_id = ${rs[0].id} and tipo = 'corte_confirmado'`;
      await ctx.pedir('post', `/api/notificaciones/${f.id}/abierta`, rs[1].token).expect(204);
      const abierta = async () =>
        (await ctx.bd.sql`select abierta_en from notificaciones where id = ${f.id}`)[0].abierta_en;
      expect(await abierta()).toBeNull();
      await ctx.pedir('post', `/api/notificaciones/${f.id}/abierta`, rs[0].token).expect(204);
      expect(new Date(String(await abierta()))).toEqual(caracas('14:30'));
      await ctx.pedir('post', '/api/notificaciones/no-es-uuid/abierta', rs[0].token).expect(400);
    });

    it('NOT-15: ningún mensaje lleva coordenadas (NF-06)', async () => {
      const rs = await vecinos(4);
      await confirmarCorte(rs.slice(0, 3));
      await envio.enviarPendientes();
      const texto = JSON.stringify(ctx.push.enviados.map((e) => e.mensaje));
      expect(texto).not.toMatch(/-?\d{1,3}\.\d{4,}/);
      expect(texto).not.toMatch(/lat|lng|ubicacion|coordinates/i);
    });
  });

  describe('imagen del hexágono (idea b)', () => {
    it('NOT-15: PNG público del sector y sus vecinos, que se puede cargar desde otro origen', async () => {
      const res = await ctx
        .pedir('get', '/api/notificaciones/imagen/1/electricidad')
        .buffer(true)
        .parse((r, cb) => {
          const partes: Buffer[] = [];
          r.on('data', (p: Buffer) => partes.push(p));
          r.on('end', () => cb(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      const png = res.body as Buffer;
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(720);
      expect(png.readUInt32BE(20)).toBe(360);
    });

    it('404 si el sector no existe y 400 con un servicio inválido', async () => {
      const res = await ctx.pedir('get', '/api/notificaciones/imagen/999/agua').expect(404);
      expect(res.body.codigo).toBe('SECTOR_NO_ENCONTRADO');
      await ctx.pedir('get', '/api/notificaciones/imagen/1/gas').expect(400);
    });
  });
});
