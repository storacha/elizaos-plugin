import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storagePlugin, getStorageClient } from '../src/index';
import { uploadAction, retrieveAction } from '../src/actions';
import { StorageClientInterface } from '../src/clients/storage';
import { storageClientEnvSchema } from '../src/environments';

// Mock dependencies
vi.mock('../src/clients/storage', () => {
  const mockStorageClient = {
    getStorage: vi.fn().mockReturnValue('mock-storage-client'),
    stop: vi.fn()
  };
  
  return {
    StorageClientInterface: {
      name: 'storage',
      start: vi.fn().mockResolvedValue(mockStorageClient)
    },
    StorageClientInstanceImpl: class MockStorageClientImpl {
      getStorage = vi.fn().mockReturnValue('mock-storage-client');
    }
  };
});

describe('storagePlugin', () => {
  it('should export the correct plugin structure', () => {
    expect(storagePlugin).toBeDefined();
    expect(storagePlugin.name).toBe('storage');
    expect(storagePlugin.description).toContain('decentralized storage');
    
    // Check config
    expect(storagePlugin.config).toBe(storageClientEnvSchema);
    
    // Check actions
    expect(storagePlugin.actions).toHaveLength(2);
    expect(storagePlugin.actions).toContain(uploadAction);
    expect(storagePlugin.actions).toContain(retrieveAction);
    
    // Check clients
    expect(storagePlugin.clients).toBeDefined();
    expect(Array.isArray(storagePlugin.clients)).toBe(true);
    expect(storagePlugin.clients?.length).toBe(1);
    expect(storagePlugin.clients?.[0]).toBe(StorageClientInterface);
    
    // Check empty arrays
    expect(storagePlugin.services).toHaveLength(0);
    expect(storagePlugin.evaluators).toHaveLength(0);
    expect(storagePlugin.providers).toHaveLength(0);
  });

  it('should export the plugin as default export', () => {
    const defaultExport = storagePlugin;
    expect(defaultExport).toBeDefined();
    expect(defaultExport.name).toBe('storage');
  });
});

describe('getStorageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the storage client when plugin is found in runtime', async () => {
    const mockRuntime = {
      plugins: [
        {
          name: 'storage',
          clients: [StorageClientInterface]
        }
      ]
    };

    const result = await getStorageClient(mockRuntime as any);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('getStorage');
    expect(StorageClientInterface.start).toHaveBeenCalledWith(mockRuntime);
  });

  it('should throw an error when plugin is not found in runtime', async () => {
    const mockRuntime = {
      plugins: [
        {
          name: 'different-plugin',
          clients: []
        }
      ]
    };

    await expect(getStorageClient(mockRuntime as any)).rejects.toThrow('Storage client not found in runtime');
  });

  it('should throw an error when plugin has no clients', async () => {
    const mockRuntime = {
      plugins: [
        {
          name: 'storage',
          clients: []
        }
      ]
    };

    await expect(getStorageClient(mockRuntime as any)).rejects.toThrow('Storage client not found in runtime');
  });
}); 