import { ClientInstance, IAgentRuntime, Client, Plugin } from '@elizaos/core';
import * as Storage from '@web3-storage/w3up-client';
import { z } from 'zod';

declare const storageClientEnvSchema: z.ZodObject<{
    STORACHA_AGENT_PRIVATE_KEY: z.ZodString;
    STORACHA_AGENT_DELEGATION: z.ZodString;
    GATEWAY_URL: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    STORACHA_AGENT_PRIVATE_KEY?: string;
    STORACHA_AGENT_DELEGATION?: string;
    GATEWAY_URL?: string;
}, {
    STORACHA_AGENT_PRIVATE_KEY?: string;
    STORACHA_AGENT_DELEGATION?: string;
    GATEWAY_URL?: string;
}>;
type StorageClientConfig = z.infer<typeof storageClientEnvSchema>;

declare class StorageClientInstanceImpl implements ClientInstance {
    private readonly runtime;
    private storage;
    config: StorageClientConfig | null;
    constructor(runtime: IAgentRuntime);
    start(): Promise<void>;
    stop(runtime?: IAgentRuntime): Promise<void>;
    getStorage(): Storage.Client;
    getConfig(): {
        STORACHA_AGENT_PRIVATE_KEY?: string;
        STORACHA_AGENT_DELEGATION?: string;
        GATEWAY_URL?: string;
    };
    getGatewayUrl(): string;
    getContent(cid: string): Promise<Response>;
}
declare const StorageClientInterface: Client;

declare const storagePlugin: Plugin;
declare const getStorageClient: (runtime: IAgentRuntime) => Promise<StorageClientInstanceImpl>;

export { StorageClientInstanceImpl as StorageClientImpl, StorageClientInterface, storagePlugin as default, getStorageClient, storagePlugin };
