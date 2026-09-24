# Compatibilidad de Drizzle con Effect rc.117

`drizzle-orm@1.0.0-rc.4` permite Effect rc.117 en sus peer dependencies,
pero sus módulos de errores y caché todavía llaman a `Schema.TaggedErrorClass`.
Effect rc.117 exporta ese constructor como `Schema.TaggedError`.

El parche cambia únicamente esas referencias en las distribuciones ESM y CJS.
pnpm lo aplica mediante `patchedDependencies` en `pnpm-workspace.yaml`.
Debe conservarse hasta actualizar a una versión de Drizzle que incluya el cambio.

El workspace usa lockfiles separados. `allowUnusedPatches` permite instalar la
raíz, que no depende de Drizzle; el lockfile del servidor registra el parche.

En rc.117, `@effect/sql-pg` administra su propio pool y ya no exporta `fromPool`.
La aplicación conserva un pool `pg` para Better Auth y otro nativo de Effect
para todos (hasta 10 conexiones por pool).
