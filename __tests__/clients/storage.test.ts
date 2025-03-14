import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageClient, createStorageClient } from '../../src/clients/storage';
import * as Storage from '@web3-storage/w3up-client';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import { Signer } from '@ucanto/principal/ed25519';
import { defaultGatewayUrl } from '../../src/utils';

// Mock dependencies
vi.mock('@web3-storage/w3up-client', () => {
  // Create a standard mock client that implements the methods we need
  const mockClient = {
    addSpace: vi.fn().mockResolvedValue({
      did: () => 'did:mock:space'
    }),
    setCurrentSpace: vi.fn().mockResolvedValue(undefined),
    upload: vi.fn().mockReturnValue({
      put: vi.fn().mockResolvedValue({
        car: { cid: 'mock-car-cid' },
        root: 'mock-root-cid'
      })
    })
  };

  return {
    create: vi.fn().mockResolvedValue(mockClient),
    Client: class MockClient {
      addSpace = vi.fn().mockResolvedValue({ did: () => 'did:mock:space' });
      setCurrentSpace = vi.fn().mockResolvedValue(undefined);
    }
  };
});

vi.mock('@web3-storage/w3up-client/stores/memory', () => ({
  StoreMemory: class MockStoreMemory { }
}));

vi.mock('@ucanto/principal/ed25519', () => ({
  Signer: {
    parse: vi.fn().mockReturnValue({ did: () => 'did:key:mock' })
  }
}));

vi.mock('../../src/utils', () => ({
  defaultGatewayUrl: 'https://w3s.link',
  parseDelegation: vi.fn().mockResolvedValue({ proofs: [] })
}));

vi.mock('../../src/environments', () => ({
  validateStorageClientConfig: vi.fn().mockResolvedValue({
    STORACHA_AGENT_PRIVATE_KEY: 'mock-private-key',
    STORACHA_AGENT_DELEGATION: 'mock-delegation',
    GATEWAY_URL: 'https://mock-gateway.link'
  })
}));

// Clear mocks once before all tests
beforeEach(() => {
  vi.clearAllMocks();
});

describe('StorageClient', () => {
  let storageClient: StorageClient;
  let mockRuntime: any;

  beforeEach(() => {
    storageClient = new StorageClient();
    mockRuntime = {
      getParameter: vi.fn(),
    };
    console.log = vi.fn(); // Mock console.log to avoid cluttering test output
  });

  describe('start', () => {
    it('should initialize the storage client', async () => {
      const instance = await storageClient.start(mockRuntime);

      expect(storageClient.getStorageClient()).not.toBeNull();
      expect(instance.stop).toBeDefined();
      expect(instance.stop).toBeInstanceOf(Function);
    });
    
    it('should throw an error when start is called a second time', async () => {
      // First call to start should succeed
      await storageClient.start(mockRuntime);
      
      // Second call to start should throw an error
      await expect(storageClient.start(mockRuntime))
        .rejects.toThrow('Storage client already initialized');
    });
    
    it('should handle API errors during client initialization', async () => {
      const mockError = new Error('API connection failed');
      const createSpy = vi.spyOn(Storage, 'create').mockRejectedValueOnce(mockError);
      
      await expect(storageClient.start(mockRuntime)).rejects.toThrow('API connection failed');
      
      // Clean up
      createSpy.mockRestore();
    });
  });

  describe('getStorageClient', () => {
    it('should throw error if client is not initialized', () => {
      expect(() => storageClient.getStorageClient()).toThrow('Storage client not initialized');
    });

    it('should return the storage client when initialized', async () => {
      await storageClient.start(mockRuntime);

      expect(storageClient.getStorageClient()).not.toBeNull();
    });
  });

  describe('getConfig', () => {
    it('should throw error if client is not initialized', () => {
      expect(() => storageClient.getConfig()).toThrow('Storage client not initialized');
    });

    it('should return the config when initialized', async () => {
      await storageClient.start(mockRuntime);

      expect(storageClient.getConfig()).not.toBeNull();
      expect(storageClient.getConfig()).toHaveProperty('GATEWAY_URL');
      expect(storageClient.getConfig()).toHaveProperty('STORACHA_AGENT_PRIVATE_KEY');
      expect(storageClient.getConfig()).toHaveProperty('STORACHA_AGENT_DELEGATION');
    });
  });

  describe('getGatewayUrl', () => {
    it('should return default gateway URL if client not initialized with config', () => {
      storageClient.config = null;

      const result = storageClient.getGatewayUrl();

      expect(result).toBe(defaultGatewayUrl);
    });

    it('should return configured gateway URL when available', async () => {
      await storageClient.start(mockRuntime);

      const result = storageClient.getGatewayUrl();

      expect(result).toBe('https://mock-gateway.link');
    });
  });
  
  describe('client lifecycle', () => {
    it('should properly clean up resources when stopped', async () => {
      const instance = await storageClient.start(mockRuntime);
      expect(storageClient.getStorageClient()).not.toBeNull();
      
      await instance.stop(mockRuntime);
      
      expect(() => storageClient.getStorageClient()).toThrow('Storage client not initialized');
      expect(() => storageClient.getConfig()).toThrow('Storage client not initialized');
    });
  });
});

describe('createStorageClient', () => {
  it('should throw error if agent private key is missing', async () => {
    const config = {
      STORACHA_AGENT_DELEGATION: 'mock-delegation',
      GATEWAY_URL: 'https://mock-gateway.link'
    };

    await expect(createStorageClient(config as any)).rejects.toThrow('Agent private key is missing');
  });

  it('should throw error if agent delegation is missing', async () => {
    const config = {
      STORACHA_AGENT_PRIVATE_KEY: 'mock-private-key',
      GATEWAY_URL: 'https://mock-gateway.link'
    };

    await expect(createStorageClient(config as any)).rejects.toThrow('Agent delegation is missing');
  });

  it('should create a storage client successfully with correct parameters', async () => {
    const config = {
      STORACHA_AGENT_PRIVATE_KEY: 'mock-private-key',
      STORACHA_AGENT_DELEGATION: 'mock-delegation',
      GATEWAY_URL: 'https://mock-gateway.link'
    };

    const mockClient = {
      addSpace: vi.fn().mockResolvedValue({
        did: () => 'did:mock:space'
      }),
      setCurrentSpace: vi.fn().mockResolvedValue(undefined)
    };
    (Storage.create as any).mockResolvedValue(mockClient);

    const result = await createStorageClient(config);

    expect(result).toBe(mockClient);
    expect(Storage.create).toHaveBeenCalledWith(expect.objectContaining({
      principal: expect.anything(),
      store: expect.any(StoreMemory)
    }));
    
    expect(mockClient.addSpace).toHaveBeenCalledWith({ proofs: [] });
    expect(mockClient.setCurrentSpace).toHaveBeenCalledWith('did:mock:space');
  });
  
  it('should handle errors during space addition', async () => {
    const config = {
      STORACHA_AGENT_PRIVATE_KEY: 'mock-private-key',
      STORACHA_AGENT_DELEGATION: 'mock-delegation',
      GATEWAY_URL: 'https://mock-gateway.link'
    };

    const spaceError = new Error('Failed to add space');
    const mockClient = {
      addSpace: vi.fn().mockRejectedValue(spaceError),
      setCurrentSpace: vi.fn()
    };
    (Storage.create as any).mockResolvedValue(mockClient);

    await expect(createStorageClient(config)).rejects.toThrow('Failed to add space');
    expect(mockClient.addSpace).toHaveBeenCalled();
    expect(mockClient.setCurrentSpace).not.toHaveBeenCalled();
  });
  
  it('should handle errors during space selection', async () => {
    const config = {
      STORACHA_AGENT_PRIVATE_KEY: 'mock-private-key',
      STORACHA_AGENT_DELEGATION: 'mock-delegation',
      GATEWAY_URL: 'https://mock-gateway.link'
    };

    const mockSpace = { did: () => 'did:mock:space' };
    const spaceError = new Error('Failed to select space');
    const mockClient = {
      addSpace: vi.fn().mockResolvedValue(mockSpace),
      setCurrentSpace: vi.fn().mockRejectedValue(spaceError)
    };
    (Storage.create as any).mockResolvedValue(mockClient);

    await expect(createStorageClient(config)).rejects.toThrow('Failed to select space');
    expect(mockClient.addSpace).toHaveBeenCalled();
    expect(mockClient.setCurrentSpace).toHaveBeenCalledWith('did:mock:space');
  });
}); 