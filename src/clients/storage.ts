import * as Storage from '@web3-storage/w3up-client';
import { Client, IAgentRuntime, ClientInstance, elizaLogger } from "@elizaos/core";
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import { Signer } from '@ucanto/principal/ed25519';
import { StorageClientConfig, validateStorageClientConfig } from "../environments";
import { defaultGatewayUrl, parseDelegation } from '../utils';

export class StorageClientInstanceImpl implements ClientInstance {
    private readonly runtime: IAgentRuntime;
    private storage: Storage.Client | null = null;
    config: StorageClientConfig | null = null;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async start(): Promise<void> {
        try {
            if (this.storage) {
                elizaLogger.info("Storage client already initialized");
                return;
            }
            this.config = await validateStorageClientConfig(this.runtime);
            this.storage = await createStorageClient(this.config);
            elizaLogger.success(`✅ Storage client successfully started`);
        } catch (error) {
            elizaLogger.error(error, "❌ Storage client failed to start");
            throw error;
        }
    }

    async stop(runtime?: IAgentRuntime): Promise<void> {
        this.storage = null;
        this.config = null;
    }

    getStorage() {
        if (!this.storage) {
            throw new Error("Storage client not initialized");
        }
        return this.storage;
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

    getContent(cid: string): Promise<Response> {
        return fetch(`${this.getGatewayUrl()}/ipfs/${cid}`);
    }
}

export const StorageClientInterface: Client = {
    name: 'storage',
    start: async (runtime: IAgentRuntime): Promise<ClientInstance> => {
        const storageClient = new StorageClientInstanceImpl(runtime);
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
