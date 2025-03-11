import type { Plugin } from "@elizaos/core";
import { uploadAction } from "./actions/upload.ts";
import { storageClientEnvSchema } from "./environments.ts";
import { retrieveAction } from "./actions/retrieve.ts";
import { storageClient } from "./services";
export * as actions from "./actions";
export * as services from "./services";

export const storagePlugin: Plugin = {
    name: "storage",
    description: "Plugin to manage files in a decentralized storage network",
    config: storageClientEnvSchema,
    actions: [uploadAction, retrieveAction],
    clients: [storageClient],
    services: [],
    evaluators: [],
    providers: [],
};
export default storagePlugin;

