import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import * as tables from "../../modules/auth/tables.ts";
import { AuthDatabase, type AuthDb } from "../database/auth-client.ts";

const makeAuth = (db: AuthDb, origin: string, secret: string) =>
	betterAuth({
		appName: "Mi aplicación",
		baseURL: origin,
		basePath: "/api/auth",
		secret,

		trustedOrigins: [origin],

		database: drizzleAdapter(db, {
			provider: "pg",
			schema: tables,
			transaction: true,
		}),

		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
			maxPasswordLength: 128,

			// Activar cuando configures el envío de correo.
			requireEmailVerification: false,
		},

		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: false,
			},
		},

		advanced: {
			// El puente HTTP establece esta cabecera con la IP del socket.
			ipAddress: {
				ipAddressHeaders: ["x-auth-client-ip"],
			},
			useSecureCookies: origin.startsWith("https://"),
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "lax",
			},
		},

		rateLimit: {
			enabled: true,
			storage: "memory",
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": {
					window: 60,
					max: 5,
				},
			},
		},
	});

export class Auth extends Context.Service<
	Auth,
	{
		readonly instance: ReturnType<typeof makeAuth>;
		readonly origin: string;
	}
>()("app/auth/Auth") {
	static readonly layer = Layer.effect(
		Auth,
		Effect.gen(function* () {
			const db = yield* AuthDatabase;
			const baseURL = yield* Config.URL("BETTER_AUTH_URL");
			const secret = yield* Config.Redacted("BETTER_AUTH_SECRET");

			yield* Schema.decodeUnknownEffect(
				Schema.String.check(Schema.isMinLength(32)),
			)(Redacted.value(secret)).pipe(
				Effect.mapError(
					() =>
						new Error("BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
				),
			);

			const origin = baseURL.origin;

			return {
				instance: makeAuth(db, origin, Redacted.value(secret)),
				origin,
			};
		}),
	);
}
