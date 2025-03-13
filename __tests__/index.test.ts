import { describe, it, expect } from 'vitest';
import { storagePlugin } from '../src/index';
import { uploadAction, retrieveAction } from '../src/actions';
import { storageClient } from '../src/clients/storage';
import { storageClientEnvSchema } from '../src/environments';

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
    expect(storagePlugin.clients?.[0]).toBe(storageClient);
    
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