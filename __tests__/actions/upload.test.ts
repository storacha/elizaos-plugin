import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAction } from '../../src/actions/upload';
import { validateStorageClientConfig } from '../../src/environments';
import { createStorageClient } from '../../src/clients/storage';
import { elizaLogger } from '@elizaos/core';
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
    
    describe('error logging', () => {
      it('should log full error object with stacktrace, not just the message', async () => {
        const mockAttachments = [
          { url: 'file:///path/to/file.txt', title: 'file.txt', contentType: 'text/plain' }
        ];
        const mockMessage = { content: { attachments: mockAttachments } };
        
        // Create an error with a stack trace
        const errorWithStack = new Error('Test error with stack');
        
        // Reject with the full error object that has a stack
        (createStorageClient as any).mockRejectedValueOnce(errorWithStack);
        
        // Call the handler
        await uploadAction.handler(
          mockRuntime,
          mockMessage as any,
          {} as any,
          {},
          mockCallback
        );
        
        // Verify error logging
        expect(elizaLogger.error).toHaveBeenCalled();
        
        // Check that the first argument to elizaLogger.error is the full error object
        const errorArg = (elizaLogger.error as any).mock.calls[0][0];
        
        // Verify we're passing the full error object, not just the message
        expect(errorArg).toBe(errorWithStack);
        expect(errorArg).toBeInstanceOf(Error);
        
        // In a real test environment, the error would have a stack property
        expect(errorArg).toEqual(expect.objectContaining({
          message: 'Test error with stack'
        }));
      });
      
      it('should include custom context message with error logs', async () => {
        const mockAttachments = [
          { url: 'file:///path/to/file.txt', title: 'file.txt', contentType: 'text/plain' }
        ];
        const mockMessage = { content: { attachments: mockAttachments } };
        
        const error = new Error('Test error');
        (createStorageClient as any).mockRejectedValueOnce(error);
        
        await uploadAction.handler(
          mockRuntime,
          mockMessage as any,
          {} as any,
          {},
          mockCallback
        );
        
        // Check that a context message is provided as the second parameter
        expect(elizaLogger.error).toHaveBeenCalledWith(
          error,
          "Error uploading file(s) to Storacha"
        );
      });
    });
  });
}); 