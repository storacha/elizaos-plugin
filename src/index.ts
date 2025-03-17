import type { ClientInstance, IAgentRuntime, Plugin } from "@elizaos/core";
import { uploadAction, retrieveAction } from "./actions";
import { storageClientEnvSchema } from "./environments.ts";
import { StorageClientInstanceImpl, StorageClientInterface } from "./clients/storage.ts";
import * as Storage from '@web3-storage/w3up-client';
export { StorageClientInterface, StorageClientInstanceImpl as StorageClientImpl } from "./clients/storage.ts";


const PluginName = "storage";

export const storagePlugin: Plugin = {
    name: PluginName,
    description: "Plugin to manage files in a decentralized storage network",
    config: storageClientEnvSchema,
    actions: [uploadAction, retrieveAction],
    clients: [StorageClientInterface],
    services: [],
    evaluators: [],
    providers: [],
};


/**
 * A helper function for Agent to get the storage client.
 * It returns the first storage client from the runtime that is identified as plugin.name === storage.
 * 
 * @param runtime - The runtime to get the storage client from.
 * @returns The storage client.
 * @throws An error if no storage client is found.
 */
export const getStorageClient = async (runtime: IAgentRuntime): Promise<StorageClientInstanceImpl> => {
    const storagePlugin = runtime.plugins.find((plugin) => plugin.name === PluginName);
    if (storagePlugin && storagePlugin.clients && storagePlugin.clients.length > 0) {
        const [storageStarter] = storagePlugin.clients;
        if (storageStarter) {
            const storageClient = await storageStarter.start(runtime);
            return storageClient as StorageClientInstanceImpl;
        }
    }
    throw new Error("Storage client not found in runtime");
}

export default storagePlugin;

