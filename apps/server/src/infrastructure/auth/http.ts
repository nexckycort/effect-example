import { Effect, Option } from 'effect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http'
import { AuthUnavailable } from '../../modules/auth/contract.ts'
import { Auth } from './client.ts'

export const authHeaders = (request: HttpServerRequest.HttpServerRequest) => {
  const headers = new Headers(request.headers)

  headers.delete('x-auth-client-ip')

  const peer = Option.getOrUndefined(request.remoteAddress)

  if (peer) {
    headers.set('x-auth-client-ip', peer)
  }

  return headers
}

export const BetterAuthRoutes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const { instance } = yield* Auth

    const handle = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest

      // Better Auth debe recibir el cuerpo sin consumir.
      const webRequest = yield* HttpServerRequest.toWeb(request)

      const response = yield* Effect.tryPromise({
        try: () =>
          instance.handler(
            new Request(webRequest, {
              headers: authHeaders(request),
            })
          ),
        catch: () => new AuthUnavailable(),
      })

      return HttpServerResponse.fromWeb(response)
    }).pipe(
      Effect.catchTag('AuthUnavailable', () =>
        Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { _tag: 'AuthUnavailable' },
            { status: 503 }
          )
        )
      )
    )

    yield* router.add('GET', '/api/auth/*', handle)
    yield* router.add('POST', '/api/auth/*', handle)
  })
)
