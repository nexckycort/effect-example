import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Api } from '../../api.ts';
import { Todos } from './service.ts';

export const TodosHandlers = HttpApiBuilder.group(Api, 'todos', (handlers) =>
  Effect.gen(function* () {
    const todos = yield* Todos;
    return handlers
      .handle('create', ({ payload }) => todos.create(payload.title))
      .handle('list', ({ query }) => todos.list(query))
      .handle('get', ({ params }) => todos.get(params.id))
      .handle('update', ({ params, payload }) =>
        todos.update(params.id, payload),
      )
      .handle('remove', ({ params }) => todos.remove(params.id));
  }),
).pipe(Layer.provide(Todos.layer));
