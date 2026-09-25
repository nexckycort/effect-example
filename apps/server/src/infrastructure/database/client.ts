import { PgClient } from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import { Config, Context, type Effect, Layer } from 'effect'

const PgClientLive = PgClient.layerConfig({
  url: Config.Redacted('DATABASE_URL'),
  maxConnections: Config.succeed(10),
  connectTimeout: Config.succeed('5 seconds'),
  idleTimeout: Config.succeed('30 seconds'),
  applicationName: Config.succeed('effect-auth'),
  startupParameters: { statement_timeout: Config.succeed('5000') },
})

const make = PgDrizzle.makeWithDefaults()
export type Db = Effect.Success<typeof make>

export class Database extends Context.Service<Database, Db>()('app/Database') {
  static readonly layer = Layer.effect(Database, make).pipe(
    Layer.provide(PgClientLive)
  )
}
