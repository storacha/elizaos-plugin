import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAction } from '../../src/actions/upload';
import { validateStorageClientConfig } from '../../src/environments';
import { createStorageClient } from '../../src/clients/storage';
import fs from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('test file content')),
    promises: {
      readFile: vi.fn().mockResolvedValue(Buffer.from('test file content')),
      stat: vi.fn().mockResolvedValue({
        isFile: () => true,
        size: 1024
      })
    }
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

vi.mock('../../src/environments', () => ({
  validateStorageClientConfig: vi.fn().mockResolvedValue({
    GATEWAY_URL: 'https://mock-gateway.link'
  })
}));

vi.mock('../../src/clients/storage', () => {
  const mockPut = vi.fn().mockResolvedValue({
    car: { cid: 'mock-car-cid' },
    root: 'mock-root-cid'
  });
  
  return {
    createStorageClient: vi.fn().mockResolvedValue({
      upload: vi.fn().mockReturnValue({
        put: mockPut
      })
    })
  };
});

describe('uploadAction', () => {
  let mockRuntime: any;
  let mockCallback: any;
  
  beforeEach(() => {
    mockRuntime = {
      getParameter: vi.fn()
    };
    mockCallback = vi.fn();
    
    vi.clearAllMocks();
  });
  
  describe('validate', () => {
    it('should return true when validation passes', async () => {
      const mockMessage = { content: { text: 'Test message' } };
      const result = await uploadAction.validate(mockRuntime, mockMessage as any);
      
      expect(result).toBe(true);
      expect(validateStorageClientConfig).toHaveBeenCalledWith(mockRuntime);
    });
  });
  
  describe('handler', () => {
    it('should return false when no attachments are provided', async () => {
      const mockMessage = { content: { attachments: [] } };
      
      const result = await uploadAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(false);
      expect(mockCallback).toHaveBeenCalledWith({ 
        text: "Looks like you didn't attach any files. Please attach a file and try again.",
        action: null
      });
    });
    
    it('should handle file uploads when attachments are provided', async () => {
      const mockAttachments = [
        { url: 'file:///path/to/file1.txt', title: 'file1.txt' },
        { url: 'file:///path/to/file2.jpg', title: 'file2.jpg' }
      ];
      const mockMessage = { content: { attachments: mockAttachments } };
      
      const result = await uploadAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(mockCallback).toHaveBeenNthCalledWith(1, {
        text: "Sure thing! Starting the engines, hold on tight. Uploading file(s) to Storacha...",
        action: null
      });
      expect(validateStorageClientConfig).toHaveBeenCalled();
      expect(createStorageClient).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    it('should handle errors from reading non-file URLs', async () => {
      const mockAttachments = [
        { url: 'https://example.com/image.jpg', title: 'web-image.jpg' }
      ];
      const mockMessage = { content: { attachments: mockAttachments } };
      
      (fs.readFileSync as any).mockImplementationOnce(() => {
        throw new Error('default.readFileSync is not a function');
      });
      
      const result = await uploadAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(mockCallback).toHaveBeenNthCalledWith(1, {
        text: "Sure thing! Starting the engines, hold on tight. Uploading file(s) to Storacha...",
        action: null
      });
      expect(mockCallback).toHaveBeenNthCalledWith(2, {
        text: "I'm sorry, I couldn't upload the file(s) to Storacha. Please try again later.",
        content: { error: 'default.readFileSync is not a function' }
      });
    });
    
    it('should handle errors during client initialization', async () => {
      const mockAttachments = [
        { url: 'file:///path/to/file.txt', title: 'file.txt' }
      ];
      const mockMessage = { content: { attachments: mockAttachments } };
      const mockError = new Error('Upload failed');
      (createStorageClient as any).mockRejectedValueOnce(mockError);
      
      const result = await uploadAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(false);
      expect(mockCallback).toHaveBeenNthCalledWith(1, {
        text: "Sure thing! Starting the engines, hold on tight. Uploading file(s) to Storacha...",
        action: null
      });
      expect(mockCallback).toHaveBeenNthCalledWith(2, {
        text: "I'm sorry, I couldn't upload the file(s) to Storacha. Please try again later.",
        content: { error: 'Upload failed' }
      });
    });
  });
}); 