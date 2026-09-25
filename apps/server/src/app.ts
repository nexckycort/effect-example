import { Layer } from 'effect'
import { HttpApiBuilder, HttpApiScalar } from 'effect/unstable/httpapi'
import { Api } from './api.ts'
import { Auth } from './infrastructure/auth/client.ts'
import { BetterAuthRoutes } from './infrastructure/auth/http.ts'
import { AuthDatabase } from './infrastructure/database/auth-client.ts'
import { Database } from './infrastructure/database/client.ts'
import { PostgresPool } from './infrastructure/database/pool.ts'
import { MeHandlers, SessionAuthLive } from './modules/auth/http.ts'
import { TodosHandlers } from './modules/todos/http.ts'

const ApiRoutes = HttpApiBuilder.layer(Api, {
  openapiPath: '/openapi.json',
}).pipe(
  Layer.provide([MeHandlers, TodosHandlers]),
  Layer.provide(SessionAuthLive)
)

export const AppRoutes = Layer.mergeAll(
  ApiRoutes,
  BetterAuthRoutes,
  HttpApiScalar.layer(Api, { path: '/docs' })
).pipe(
  Layer.provide(Auth.layer),
  Layer.provide([Database.layer, AuthDatabase.layer]),
  Layer.provide(PostgresPool.layer)
)
