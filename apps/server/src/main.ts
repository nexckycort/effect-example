import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Config, Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';

import { AppRoutes } from './app.ts';

const ServerLive = HttpRouter.serve(AppRoutes).pipe(
  Layer.provide(
    BunHttpServer.layerConfig({
      hostname: Config.String('HOST').pipe(Config.withDefault('127.0.0.1')),
      port: Config.Port('PORT').pipe(Config.withDefault(3000)),
    }),
  ),
);

BunRuntime.runMain(Layer.launch(ServerLive));
