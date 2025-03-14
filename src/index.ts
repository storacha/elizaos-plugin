import type { Plugin } from "@elizaos/core";
import { uploadAction, retrieveAction } from "./actions";
import { storageClientEnvSchema } from "./environments.ts";
import { StorageClientInterface } from "./clients/storage.ts";

export const storagePlugin: Plugin = {
    name: "storage",
    description: "Plugin to manage files in a decentralized storage network",
    config: storageClientEnvSchema,
    actions: [uploadAction, retrieveAction],
    clients: [StorageClientInterface],
    services: [],
    evaluators: [],
    providers: [],
};
export default storagePlugin;

