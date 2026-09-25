import { Schema } from 'effect'
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi'
import { SessionAuth } from '../auth/contract.ts'

const Title = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200),
  Schema.isPattern(/\S/)
)
export const TodoId = Schema.String.check(Schema.isUUID())
export const Todo = Schema.Struct({
  id: TodoId,
  title: Title,
  done: Schema.Boolean,
})
export type Todo = typeof Todo.Type
export const CreateTodo = Schema.Struct({ title: Title })
export const UpdateTodo = Schema.Struct({
  title: Schema.optional(Title),
  done: Schema.optional(Schema.Boolean),
}).check(
  Schema.makeFilter(
    (value) => value.title !== undefined || value.done !== undefined
  )
)
export type UpdateTodo = typeof UpdateTodo.Type
export const ListQuery = Schema.Struct({
  limit: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
  ),
  offset: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100_000 }))
  ),
})
export type ListQuery = typeof ListQuery.Type

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>()(
  'TodoNotFound',
  {},
  { httpApiStatus: 404 }
) {}
export class TodoStorageError extends Schema.TaggedError<TodoStorageError>()(
  'TodoStorageError',
  {},
  { httpApiStatus: 500 }
) {}

export const TodosApi = HttpApiGroup.make('todos')
  .add(
    HttpApiEndpoint.post('create', '/api/todos', {
      payload: CreateTodo,
      success: Todo.pipe(HttpApiSchema.status(201)),
      error: TodoStorageError,
    }),
    HttpApiEndpoint.get('list', '/api/todos', {
      query: {
        limit: Schema.optional(
          Schema.NumberFromString.check(
            Schema.isInt(),
            Schema.isBetween({ minimum: 1, maximum: 100 })
          )
        ),
        offset: Schema.optional(
          Schema.NumberFromString.check(
            Schema.isInt(),
            Schema.isBetween({ minimum: 0, maximum: 100_000 })
          )
        ),
      },
      success: Schema.Array(Todo),
      error: TodoStorageError,
    }),
    HttpApiEndpoint.get('get', '/api/todos/:id', {
      params: { id: TodoId },
      success: Todo,
      error: [TodoNotFound, TodoStorageError],
    }),
    HttpApiEndpoint.patch('update', '/api/todos/:id', {
      params: { id: TodoId },
      payload: UpdateTodo,
      success: Todo,
      error: [TodoNotFound, TodoStorageError],
    }),
    HttpApiEndpoint.delete('remove', '/api/todos/:id', {
      params: { id: TodoId },
      success: HttpApiSchema.NoContent,
      error: [TodoNotFound, TodoStorageError],
    })
  )
  .middleware(SessionAuth)
