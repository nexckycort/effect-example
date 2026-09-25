import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { user } from '../auth/tables.ts'

export const todos = pgTable(
  'todo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    done: boolean('done').notNull().default(false),
  },
  (table) => [
    index('todo_owner_id_idx').on(table.ownerId, table.id),
    check('todo_title_not_blank', sql`length(btrim(${table.title})) > 0`),
  ]
)
