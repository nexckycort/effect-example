import { HttpApi } from "effect/unstable/httpapi";
import { MeApi } from "./modules/auth/contract.ts";
import { TodosApi } from "./modules/todos/contract.ts";

export const Api = HttpApi.make("ExampleApi").add(MeApi).add(TodosApi);
