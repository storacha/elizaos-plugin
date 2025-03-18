import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStorageClient, StorageClientInstanceImpl, StorageClientInterface } from '../../src/clients/storage';
import * as Storage from '@web3-storage/w3up-client';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import { defaultGatewayUrl } from '../../src/utils';
import { elizaLogger } from '@elizaos/core';

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

vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
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

// Mock fetch for getContent tests
global.fetch = vi.fn();

// Clear mocks once before all tests
beforeEach(() => {
  vi.clearAllMocks();
});

describe('StorageClientImpl', () => {
  let storageClientImpl: StorageClientInstanceImpl;
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = {
      getParameter: vi.fn(),
    };
    console.log = vi.fn(); // Mock console.log to avoid cluttering test output
    storageClientImpl = new StorageClientInstanceImpl(mockRuntime);
    (global.fetch as any).mockReset();
  });

  it('should initialize correctly', async () => {
    await storageClientImpl.start();
    
    expect(storageClientImpl.getStorage()).not.toBeNull();
    expect(elizaLogger.success).toHaveBeenCalledWith('✅ Storage client successfully started');
  });
  
  it('should return silently when start is called a second time', async () => {
    // First call to start should succeed
    await storageClientImpl.start();
    
    // Second call to start should return silently
    await expect(storageClientImpl.start()).resolves.toBeUndefined();
    expect(elizaLogger.info).toHaveBeenCalledWith('Storage client already initialized');
  });
  
  it('should handle API errors during client initialization', async () => {
    const mockError = new Error('API connection failed');
    const createSpy = vi.spyOn(Storage, 'create').mockRejectedValueOnce(mockError);
    
    await expect(storageClientImpl.start()).rejects.toThrow('API connection failed');
    
    // Clean up
    createSpy.mockRestore();
  });
  
  it('should throw error if client is not initialized when getting storage client', () => {
    expect(() => storageClientImpl.getStorage()).toThrow('Storage client not initialized');
  });
  
  it('should return the storage client when initialized', async () => {
    await storageClientImpl.start();
    expect(storageClientImpl.getStorage()).not.toBeNull();
  });
  
  it('should throw error if client is not initialized when getting config', () => {
    expect(() => storageClientImpl.getConfig()).toThrow('Storage client not initialized');
  });
  
  it('should return the config when initialized', async () => {
    await storageClientImpl.start();
    
    expect(storageClientImpl.getConfig()).not.toBeNull();
    expect(storageClientImpl.getConfig()).toHaveProperty('GATEWAY_URL');
    expect(storageClientImpl.getConfig()).toHaveProperty('STORACHA_AGENT_PRIVATE_KEY');
    expect(storageClientImpl.getConfig()).toHaveProperty('STORACHA_AGENT_DELEGATION');
  });
  
  it('should return default gateway URL if client not initialized with config', () => {
    expect(storageClientImpl.getGatewayUrl()).toBe(defaultGatewayUrl);
  });
  
  it('should return configured gateway URL when available', async () => {
    await storageClientImpl.start();
    expect(storageClientImpl.getGatewayUrl()).toBe('https://mock-gateway.link');
  });
  
  it('should properly clean up resources when stopped', async () => {
    await storageClientImpl.start();
    expect(storageClientImpl.getStorage()).not.toBeNull();
    
    await storageClientImpl.stop(mockRuntime);
    
    expect(() => storageClientImpl.getStorage()).toThrow('Storage client not initialized');
    expect(() => storageClientImpl.getConfig()).toThrow('Storage client not initialized');
  });

  describe('error logging', () => {
    it('should log full error object with stacktrace during client initialization', async () => {
      // Create an error with a stack trace
      const errorWithStack = new Error('API connection failed with stack');
      
      // Mock the client creation to throw our error with stack
      const createSpy = vi.spyOn(Storage, 'create').mockRejectedValueOnce(errorWithStack);
      
      // Expect the start method to throw
      await expect(storageClientImpl.start()).rejects.toThrow('API connection failed with stack');
      
      // Verify error logging received the full error object
      expect(elizaLogger.error).toHaveBeenCalled();
      
      // Get the first argument passed to elizaLogger.error
      const errorArg = (elizaLogger.error as any).mock.calls[0][0];
      
      // Verify it's the full error with stack
      expect(errorArg).toBe(errorWithStack);
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg).toEqual(expect.objectContaining({
        message: 'API connection failed with stack'
      }));
      
      // Clean up
      createSpy.mockRestore();
    });
    
    it('should include custom context message with error logs', async () => {
      const errorWithStack = new Error('Client initialization failed');
      const createSpy = vi.spyOn(Storage, 'create').mockRejectedValueOnce(errorWithStack);
      
      // Try to start the client, which should fail
      await expect(storageClientImpl.start()).rejects.toThrow('Client initialization failed');
      
      // Check that a context message is provided as the second parameter
      expect(elizaLogger.error).toHaveBeenCalledWith(
        errorWithStack,
        "❌ Storage client failed to start"
      );
      
      // Clean up
      createSpy.mockRestore();
    });
  });

  describe('getContent', () => {
    it('should fetch content from the configured gateway URL', async () => {
      await storageClientImpl.start();
      const testCid = 'bafytest123';
      const mockResponse = new Response('mock content');
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await storageClientImpl.getContent(testCid);

      expect(global.fetch).toHaveBeenCalledWith('https://mock-gateway.link/ipfs/bafytest123');
      expect(result).toBe(mockResponse);
    });

    it('should fetch content from the default gateway URL when not configured', async () => {
      storageClientImpl.config = null; // No config set
      const testCid = 'bafytest123';
      const mockResponse = new Response('mock content');
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await storageClientImpl.getContent(testCid);

      expect(global.fetch).toHaveBeenCalledWith(`${defaultGatewayUrl}/ipfs/bafytest123`);
      expect(result).toBe(mockResponse);
    });

    it('should propagate fetch errors', async () => {
      await storageClientImpl.start();
      const testCid = 'bafytest123';
      const mockError = new Error('Network error');
      (global.fetch as any).mockRejectedValueOnce(mockError);

      await expect(storageClientImpl.getContent(testCid)).rejects.toThrow('Network error');
    });
    
    it('should log full error object when fetch fails', async () => {
      await storageClientImpl.start();
      const testCid = 'bafytest123';
      const fetchError = new Error('Network fetch error with stack');
      (global.fetch as any).mockRejectedValueOnce(fetchError);
      
      // The getContent method doesn't have error logging, so this test is confirming
      // that it properly propagates the error without losing the stack
      await expect(storageClientImpl.getContent(testCid)).rejects.toThrow('Network fetch error with stack');
      
      // Verify the error object is intact with its properties
      try {
        await storageClientImpl.getContent(testCid);
      } catch (error) {
        expect(error).toBe(fetchError);
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('stack');
        expect(error.message).toBe('Network fetch error with stack');
      }
    });
  });
});

describe('StorageClientInterface', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = {
      getParameter: vi.fn(),
    };
    console.log = vi.fn();
  });

  it('should create and return a StorageClientImpl instance when start is called', async () => {
    const clientInstance = await StorageClientInterface.start(mockRuntime);
    
    expect(clientInstance).toBeDefined();
    expect(clientInstance.stop).toBeDefined();
    expect(clientInstance.stop).toBeInstanceOf(Function);
    expect(elizaLogger.success).toHaveBeenCalledWith('✅ Storage client successfully started');
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