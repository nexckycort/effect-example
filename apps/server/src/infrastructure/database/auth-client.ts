import { drizzle } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer } from "effect";
import type { Pool } from "pg";
import { PostgresPool } from "./pool.ts";

// Compatibilidad de Better Auth: únicamente esta integración usa la API Promise.
const make = (pool: Pool) => drizzle({ client: pool });
export type AuthDb = ReturnType<typeof make>;

export class AuthDatabase extends Context.Service<AuthDatabase, AuthDb>()(
	"app/AuthDatabase",
) {
	static readonly layer = Layer.effect(
		AuthDatabase,
		Effect.gen(function* () {
			return make(yield* PostgresPool);
		}),
	);
}
