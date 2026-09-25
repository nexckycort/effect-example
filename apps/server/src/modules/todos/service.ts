import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer, Schema } from 'effect'
import { Database } from '../../infrastructure/database/client.ts'
import { CurrentUser } from '../auth/contract.ts'
import {
  type ListQuery,
  Todo,
  TodoNotFound,
  TodoStorageError,
  type UpdateTodo,
} from './contract.ts'
import { todos } from './tables.ts'

const columns = { id: todos.id, title: todos.title, done: todos.done }
const decode = Schema.decodeUnknownEffect(Schema.Array(Todo))

// Frontera Promise -> Effect. La función se invoca al ejecutar el efecto.
const query = <A>(run: () => Effect.Effect<A, unknown, never>) =>
  run().pipe(
    Effect.mapError(() => new TodoStorageError()),
    Effect.tapError(() => Effect.logError('Todo database operation failed'))
  )

export class Todos extends Context.Service<
  Todos,
  {
    create(title: string): Effect.Effect<Todo, TodoStorageError, CurrentUser>
    list(
      input: ListQuery
    ): Effect.Effect<ReadonlyArray<Todo>, TodoStorageError, CurrentUser>
    get(
      id: string
    ): Effect.Effect<Todo, TodoNotFound | TodoStorageError, CurrentUser>
    update(
      id: string,
      input: UpdateTodo
    ): Effect.Effect<Todo, TodoNotFound | TodoStorageError, CurrentUser>
    remove(
      id: string
    ): Effect.Effect<void, TodoNotFound | TodoStorageError, CurrentUser>
  }
>()('app/todos/Todos') {
  static readonly layer = Layer.effect(
    Todos,
    Effect.gen(function* () {
      const db = yield* Database
      const rows = (
        run: () => Effect.Effect<ReadonlyArray<unknown>, unknown, never>
      ) =>
        query(run).pipe(
          Effect.flatMap(decode),
          Effect.catchTag('SchemaError', () =>
            Effect.fail(new TodoStorageError())
          )
        )

      const create = Effect.fn('Todos.create')(function* (title: string) {
        const user = yield* CurrentUser
        const result = yield* rows(() =>
          db
            .insert(todos)
            .values({ ownerId: user.id, title: title.trim() })
            .returning(columns)
        )
        if (!result[0]) return yield* new TodoStorageError()
        return result[0]
      })
      const list = Effect.fn('Todos.list')(function* (input: ListQuery) {
        const user = yield* CurrentUser
        return yield* rows(() =>
          db
            .select(columns)
            .from(todos)
            .where(eq(todos.ownerId, user.id))
            .orderBy(todos.id)
            .limit(input.limit ?? 20)
            .offset(input.offset ?? 0)
        )
      })
      const get = Effect.fn('Todos.get')(function* (id: string) {
        const user = yield* CurrentUser
        const result = yield* rows(() =>
          db
            .select(columns)
            .from(todos)
            .where(and(eq(todos.id, id), eq(todos.ownerId, user.id)))
            .limit(1)
        )
        if (!result[0]) return yield* new TodoNotFound()
        return result[0]
      })
      const update = Effect.fn('Todos.update')(function* (
        id: string,
        input: UpdateTodo
      ) {
        const user = yield* CurrentUser
        const result = yield* rows(() =>
          db
            .update(todos)
            .set({
              ...(input.title === undefined
                ? {}
                : { title: input.title.trim() }),
              ...(input.done === undefined ? {} : { done: input.done }),
            })
            .where(and(eq(todos.id, id), eq(todos.ownerId, user.id)))
            .returning(columns)
        )
        if (!result[0]) return yield* new TodoNotFound()
        return result[0]
      })
      const remove = Effect.fn('Todos.remove')(function* (id: string) {
        const user = yield* CurrentUser
        const result = yield* query(() =>
          db
            .delete(todos)
            .where(and(eq(todos.id, id), eq(todos.ownerId, user.id)))
            .returning({ id: todos.id })
        )
        if (!result[0]) return yield* new TodoNotFound()
      })
      return Todos.of({ create, list, get, update, remove })
    })
  )
}
