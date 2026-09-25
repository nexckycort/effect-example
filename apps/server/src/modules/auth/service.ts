import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth/minimal';
import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';

import {
  AuthDatabase,
  type AuthDb,
} from '../../infrastructure/database/auth-client.ts';
import * as tables from './tables.ts';

const makeAuth = (db: AuthDb, baseURL: string, secret: string) =>
  betterAuth({
    appName: 'Effect Auth Example',
    baseURL,
    basePath: '/api/auth',
    secret,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: tables,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Demo local: no se configura proveedor de correo todavía.
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['x-auth-client-ip'] },
      useSecureCookies: baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      window: 60,
      max: 100,
      customRules: { '/sign-in/email': { window: 60, max: 5 } },
    },
  });

export class Auth extends Context.Service<
  Auth,
  {
    readonly instance: ReturnType<typeof makeAuth>;
    readonly origin: string;
  }
>()('app/auth/Auth') {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const db = yield* AuthDatabase;
      const baseURL = yield* Config.URL('BETTER_AUTH_URL');
      const secret = yield* Config.Redacted('BETTER_AUTH_SECRET');
      // Fallar en el arranque si falta un secreto adecuado; nunca usar un fallback.
      yield* Schema.decodeUnknownEffect(
        Schema.String.check(Schema.isMinLength(32)),
      )(Redacted.value(secret)).pipe(
        Effect.mapError(
          () =>
            new Error('BETTER_AUTH_SECRET must contain at least 32 characters'),
        ),
      );
      const origin = baseURL.origin;
      return { instance: makeAuth(db, origin, Redacted.value(secret)), origin };
    }),
  );
}
