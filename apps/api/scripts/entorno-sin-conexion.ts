// Variables de relleno para crear la app sin `.env` (lo importa exportar-openapi.ts antes que
// AppModule, porque `ConfigModule.forRoot` valida el entorno al importarse). El documento OpenAPI no
// depende de ellas y nunca se usan para conectarse: postgres-js no abre conexiones hasta la primera
// consulta, y sin `init()` no corre ningún cron.
process.env.DATABASE_URL ??= 'postgres://openapi:openapi@localhost:5433/sin-conexion';
process.env.SUPABASE_URL ??= 'https://openapi.supabase.co';
process.env.CRON_ACTIVO = 'false';
