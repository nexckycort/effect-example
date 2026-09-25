import { and, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/unstable/http'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { Pool } from 'pg'
import { AppRoutes } from '../../app.ts'
import { account, session, user } from '../../db/schema/auth.ts'

const origin = new URL(process.env.BETTER_AUTH_URL!).origin
const { handler, dispose } = HttpRouter.toWebHandler(
  AppRoutes.pipe(Layer.provide(HttpServer.layerServices)),
  { disableLogger: true }
)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle({ client: pool })
const createdUsers: string[] = []
const password = 'Example-test-password-12345'

type UserSession = {
  id: string
  email: string
  cookie: string
  setCookies: string[]
}
let alice: UserSession
let bob: UserSession

const call = (
  method: string,
  path: string,
  cookie = '',
  body?: unknown,
  requestOrigin: string | null = origin
) =>
  handler(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(requestOrigin ? { origin: requestOrigin } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  )
const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')

const signUp = async (name: string): Promise<UserSession> => {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`
  const response = await call('POST', '/api/auth/sign-up/email', '', {
    name,
    email,
    password,
  })
  assert.equal(response.status, 200, await response.clone().text())
  const data = await response.json()
  createdUsers.push(data.user.id)
  return {
    id: data.user.id,
    email,
    cookie: cookiesOf(response),
    setCookies: response.headers.getSetCookie(),
  }
}

before(async () => {
  alice = await signUp('Alice')
  bob = await signUp('Bob')
})
after(async () => {
  try {
    await dispose()
    if (createdUsers.length)
      await db.delete(user).where(inArray(user.id, createdUsers))
  } finally {
    await pool.end()
  }
})

test('registro guarda hash y emite cookie HttpOnly; /me expone solo datos públicos', async () => {
  assert.ok(
    alice.setCookies.some(
      (cookie) =>
        /session_token=/.test(cookie) &&
        /httponly/i.test(cookie) &&
        /samesite=lax/i.test(cookie)
    )
  )
  const [credential] = await db
    .select()
    .from(account)
    .where(
      and(eq(account.userId, alice.id), eq(account.providerId, 'credential'))
    )
  assert.ok(credential?.password)
  assert.notEqual(credential.password, password)
  const response = await call('GET', '/api/me', alice.cookie)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {
    id: alice.id,
    name: 'Alice',
    email: alice.email,
    emailVerified: false,
  })
})

test('rutas privadas rechazan sesiones ausentes y cookies falsificadas', async () => {
  for (const cookie of ['', 'better-auth.session_token=forged']) {
    for (const path of ['/api/me', '/api/todos']) {
      assert.equal((await call('GET', path, cookie)).status, 401)
    }
  }
  assert.equal(
    (await call('POST', '/api/todos', '', { title: 'Test' })).status,
    401
  )
})

test('login valida la contraseña y produce una sesión utilizable', async () => {
  const bad = await call('POST', '/api/auth/sign-in/email', '', {
    email: alice.email,
    password: 'wrong-password-123',
  })
  assert.equal(bad.status, 401)
  const good = await call('POST', '/api/auth/sign-in/email', '', {
    email: alice.email,
    password,
  })
  assert.equal(good.status, 200, await good.clone().text())
  assert.equal((await call('GET', '/api/me', cookiesOf(good))).status, 200)
})

test('CRUD: el propietario sale de la sesión, y otro usuario no puede leer/editar/borrar', async () => {
  const createdResponse = await call('POST', '/api/todos', alice.cookie, {
    title: '  Aprender Effect  ',
    ownerId: bob.id,
  })
  assert.equal(createdResponse.status, 201)
  const todo = await createdResponse.json()
  assert.equal(todo.title, 'Aprender Effect')
  assert.equal(todo.done, false)
  assert.equal(
    (await call('GET', `/api/todos/${todo.id}`, alice.cookie)).status,
    200
  )
  const aliceList = await (await call('GET', '/api/todos', alice.cookie)).json()
  assert.ok(aliceList.some((item: { id: string }) => item.id === todo.id))
  const bobList = await (await call('GET', '/api/todos', bob.cookie)).json()
  assert.ok(!bobList.some((item: { id: string }) => item.id === todo.id))
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    assert.equal(
      (
        await call(
          method,
          `/api/todos/${todo.id}`,
          bob.cookie,
          method === 'PATCH' ? { done: true } : undefined
        )
      ).status,
      404
    )
  }
  const updated = await call('PATCH', `/api/todos/${todo.id}`, alice.cookie, {
    done: true,
  })
  assert.equal(updated.status, 200)
  assert.deepEqual(await updated.json(), { ...todo, done: true })
  assert.equal(
    (await call('DELETE', `/api/todos/${todo.id}`, alice.cookie)).status,
    204
  )
  assert.equal(
    (await call('GET', `/api/todos/${todo.id}`, alice.cookie)).status,
    404
  )
})

test('CSRF: nuestras escrituras requieren Origin exacto; Better Auth rechaza otro origen', async () => {
  for (const requestOrigin of [null, 'https://evil.example']) {
    assert.equal(
      (
        await call(
          'POST',
          '/api/todos',
          alice.cookie,
          { title: 'Blocked' },
          requestOrigin
        )
      ).status,
      403
    )
  }
  const response = await call(
    'POST',
    '/api/auth/sign-out',
    alice.cookie,
    {},
    'https://evil.example'
  )
  assert.equal(response.status, 403)
  assert.equal((await call('GET', '/api/me', alice.cookie)).status, 200)
})

test('validación de campos, UUID, paginación y PATCH vacío', async () => {
  for (const body of [
    { title: ' ' },
    { title: 123 },
    { title: 'a'.repeat(201) },
  ]) {
    assert.equal(
      (await call('POST', '/api/todos', alice.cookie, body)).status,
      400
    )
  }
  assert.equal(
    (await call('GET', '/api/todos/not-a-uuid', alice.cookie)).status,
    400
  )
  assert.equal(
    (await call('GET', '/api/todos?limit=101', alice.cookie)).status,
    400
  )
  assert.equal(
    (await call('PATCH', `/api/todos/${randomUUID()}`, alice.cookie, {}))
      .status,
    400
  )
})

test('la renovación de sesión propaga Set-Cookie desde getSession al cliente', async () => {
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  await db
    .update(session)
    .set({
      updatedAt: old,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .where(eq(session.userId, alice.id))
  const response = await call('GET', '/api/me', alice.cookie)
  assert.equal(response.status, 200)
  assert.ok(
    response.headers
      .getSetCookie()
      .some((cookie) => cookie.includes('session_token='))
  )
})

test('una sesión vencida no permite acceder', async () => {
  const response = await call('POST', '/api/auth/sign-in/email', '', {
    email: bob.email,
    password,
  })
  assert.equal(response.status, 200)
  const data = await response.json()
  await db
    .update(session)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(session.token, data.token))
  assert.equal((await call('GET', '/api/me', cookiesOf(response))).status, 401)
})

test('logout revoca en DB: reutilizar la cookie anterior devuelve 401', async () => {
  const response = await call('POST', '/api/auth/sign-out', alice.cookie, {})
  assert.equal(response.status, 200)
  assert.ok(
    response.headers.getSetCookie().some((cookie) => /max-age=0/i.test(cookie))
  )
  assert.equal((await call('GET', '/api/me', alice.cookie)).status, 401)
})
