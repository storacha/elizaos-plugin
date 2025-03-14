import * as Storage from '@web3-storage/w3up-client';
import { Client, IAgentRuntime, ClientInstance, elizaLogger } from "@elizaos/core";
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import { Signer } from '@ucanto/principal/ed25519';
import { StorageClientConfig, validateStorageClientConfig } from "../environments";
import { defaultGatewayUrl, parseDelegation } from '../utils';

export class StorageClientImpl {
    private readonly runtime: IAgentRuntime;
    private storageClient: Storage.Client | null = null;
    config: StorageClientConfig | null = null;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async start(): Promise<void> {
        try {
            if (this.storageClient) {
                elizaLogger.info("Storage client already initialized");
                return;
            }
            this.config = await validateStorageClientConfig(this.runtime);
            this.storageClient = await createStorageClient(this.config);
            elizaLogger.success(`✅ Storage client successfully started`);
        } catch (error) {
            elizaLogger.error(`❌ Storage client failed to start: ${error}`);
            throw error;
        }
    }

    async stop(runtime?: IAgentRuntime): Promise<void> {
        this.storageClient = null;
        this.config = null;
    }

    getStorageClient() {
        if (!this.storageClient) {
            throw new Error("Storage client not initialized");
        }
        return this.storageClient;
    }

    getConfig() {
        if (!this.config) {
            throw new Error("Storage client not initialized");
        }
        return this.config;
    }

    getGatewayUrl(): string {
        return this.config?.GATEWAY_URL || defaultGatewayUrl;
    }
}

export const StorageClientInterface: Client = {
    name: 'storage',
    start: async (runtime: IAgentRuntime): Promise<ClientInstance> => {
        const storageClient = new StorageClientImpl(runtime);
        await storageClient.start();
        return storageClient;
    }
};

export const createStorageClient = async (config: StorageClientConfig): Promise<Storage.Client> => {
    if (!config.STORACHA_AGENT_PRIVATE_KEY) {
        throw new Error("Agent private key is missing from the storage client configuration");
    }
    if (!config.STORACHA_AGENT_DELEGATION) {
        throw new Error("Agent delegation is missing from the storage client configuration");
    }

    const principal = Signer.parse(config.STORACHA_AGENT_PRIVATE_KEY);
    const store = new StoreMemory();
    const client = await Storage.create({ principal, store });

    const delegationProof = await parseDelegation(config.STORACHA_AGENT_DELEGATION);
    const space = await client.addSpace(delegationProof);
    await client.setCurrentSpace(space.did());
    console.log(`Storage client initialized`);

    return client;
}
