import { Client, IAgentRuntime, ClientInstance } from "@elizaos/core";
import * as Storage from '@web3-storage/w3up-client';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import { Signer } from '@ucanto/principal/ed25519';
import { StorageClientConfig, validateStorageClientConfig } from "../environments";
import { defaultGatewayUrl, parseDelegation } from '../utils';

export class StorageClient implements Client {
    name = "storage";
    private storageClient: Storage.Client | null = null;
    config: StorageClientConfig | null = null;

    async start(runtime: IAgentRuntime): Promise<ClientInstance> {
        if (this.storageClient) {
            throw new Error("Storage client already initialized");
        }
        this.config = await validateStorageClientConfig(runtime);
        this.storageClient = await createStorageClient(this.config);

        return {
            stop: async () => {
                this.storageClient = null;
                this.config = null;
            }
        };
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

export const storageClient = new StorageClient();
