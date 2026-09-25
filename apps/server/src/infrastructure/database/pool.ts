import { Config, Context, Data, Effect, Layer, Redacted } from 'effect';
import { Pool, types } from 'pg';

class DatabaseStartupError extends Data.TaggedError(
  'DatabaseStartupError',
)<{}> {}

export class PostgresPool extends Context.Service<PostgresPool, Pool>()(
  'app/PostgresPool',
) {
  static readonly layer = Layer.effect(
    PostgresPool,
    Effect.gen(function* () {
      const url = yield* Config.Redacted('DATABASE_URL');
      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const pool = new Pool({
            connectionString: Redacted.value(url),
            max: 10,
            connectionTimeoutMillis: 5_000,
            application_name: 'effect-auth',
            idleTimeoutMillis: 30_000,
            statement_timeout: 5_000,
            // Parsers de la guía: se configuran en el pool que realmente ejecuta SQL.
            types: {
              getTypeParser: (typeId, format) => {
                if (
                  [
                    1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182,
                  ].includes(typeId)
                ) {
                  return (value: string) => value;
                }
                return types.getTypeParser(typeId, format);
              },
            },
          });
          // Callback del driver: evitar errores no escuchados y no volcar secretos.
          pool.on('error', () =>
            console.error('PostgreSQL idle connection error'),
          );
          return pool;
        }),
        (pool) => Effect.promise(() => pool.end()),
      );
      yield* Effect.tryPromise({
        try: () => pool.query('select 1'),
        catch: () => new DatabaseStartupError(),
      });
      return pool;
    }),
  );
}
