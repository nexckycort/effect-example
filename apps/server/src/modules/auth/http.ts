import { Effect, Layer } from "effect";
import {
	Cookies,
	HttpServerRequest,
	HttpServerResponse,
} from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../../api.ts";
import { Auth } from "../../infrastructure/auth/client.ts";
import { authHeaders } from "../../infrastructure/auth/http.ts";

import {
	AuthUnavailable,
	CurrentUser,
	ForbiddenOrigin,
	SessionAuth,
	Unauthorized,
} from "./contract.ts";

export const SessionAuthLive = Layer.effect(
	SessionAuth,
	Effect.gen(function* () {
		const { instance, origin } = yield* Auth;
		return SessionAuth.of(
			Effect.fn("Auth.requireSession")(function* (next) {
				const request = yield* HttpServerRequest.HttpServerRequest;
				// Better Auth protege sus endpoints. Esta comprobación protege NUESTRAS escrituras.
				if (
					!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
					request.headers.origin !== origin
				) {
					return yield* new ForbiddenOrigin();
				}
				const result = yield* Effect.tryPromise({
					try: () =>
						instance.api.getSession({
							headers: authHeaders(request),
							returnHeaders: true,
						}),
					catch: () => new AuthUnavailable(),
				}).pipe(
					Effect.tapError(() => Effect.logError("Session verification failed")),
				);
				if (!result.response) return yield* new Unauthorized();
				const user = result.response.user;
				const response = yield* next.pipe(
					Effect.provideService(CurrentUser, {
						id: user.id,
						name: user.name,
						email: user.email,
						emailVerified: user.emailVerified,
					}),
				);
				// La renovación de sesión puede enviar varios Set-Cookie: conservar todos.
				return response.pipe(
					HttpServerResponse.mergeCookies(
						Cookies.fromSetCookie(result.headers.getSetCookie()),
					),
					HttpServerResponse.setHeader("cache-control", "no-store"),
				);
			}),
		);
	}),
);

export const MeHandlers = HttpApiBuilder.group(Api, "me", (handlers) =>
	handlers.handle("get", () => CurrentUser),
);
