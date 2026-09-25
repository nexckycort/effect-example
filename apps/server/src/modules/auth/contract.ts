import { Context, Schema } from 'effect';
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
} from 'effect/unstable/httpapi';

export const PublicUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
});
export class CurrentUser extends Context.Service<
  CurrentUser,
  typeof PublicUser.Type
>()('app/auth/CurrentUser') {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  'Unauthorized',
  {},
  { httpApiStatus: 401 },
) {}
export class ForbiddenOrigin extends Schema.TaggedError<ForbiddenOrigin>()(
  'ForbiddenOrigin',
  {},
  { httpApiStatus: 403 },
) {}
export class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()(
  'AuthUnavailable',
  {},
  { httpApiStatus: 503 },
) {}

export class SessionAuth extends HttpApiMiddleware.Service<
  SessionAuth,
  { provides: CurrentUser }
>()('app/auth/SessionAuth', {
  error: [Unauthorized, ForbiddenOrigin, AuthUnavailable],
}) {}

export const MeApi = HttpApiGroup.make('me')
  .add(HttpApiEndpoint.get('get', '/api/me', { success: PublicUser }))
  .middleware(SessionAuth);
