import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retrieveAction } from '../../src/actions/retrieve';
import { validateStorageClientConfig } from '../../src/environments';
import { defaultGatewayUrl, getCIDsFromMessage } from '../../src/utils';

// Mock dependencies
vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('../../src/environments', () => ({
  validateStorageClientConfig: vi.fn().mockResolvedValue({
    GATEWAY_URL: 'https://mock-gateway.link'
  })
}));

vi.mock('../../src/utils', () => ({
  defaultGatewayUrl: 'https://w3s.link',
  getCIDsFromMessage: vi.fn()
}));

describe('retrieveAction', () => {
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
      
      const result = await retrieveAction.validate(mockRuntime, mockMessage as any);
      
      expect(result).toBe(true);
      expect(validateStorageClientConfig).toHaveBeenCalledWith(mockRuntime);
    });
  });
  
  describe('handler', () => {
    it('should return false when no CIDs are found in the message', async () => {
      const mockMessage = { content: { text: 'No CIDs here' } };
      (getCIDsFromMessage as any).mockReturnValue([]);
      
      const result = await retrieveAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(false);
      expect(getCIDsFromMessage).toHaveBeenCalledWith(mockMessage);
      expect(mockCallback).toHaveBeenCalledWith({ 
        text: "You didn't provide any CIDs to retrieve the content." 
      });
    });
    
    it('should return true and generate download links when CIDs are found', async () => {
      const mockMessage = { content: { text: 'Get file with CID QmTest123 and bafyTest456' } };
      const mockCIDs = ['QmTest123', 'bafyTest456'];
      (getCIDsFromMessage as any).mockReturnValue(mockCIDs);
      
      const result = await retrieveAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(true);
      expect(getCIDsFromMessage).toHaveBeenCalledWith(mockMessage);
      expect(mockCallback).toHaveBeenCalledWith({
        text: expect.stringContaining('https://mock-gateway.link/ipfs/QmTest123')
      });
      expect(mockCallback).toHaveBeenCalledWith({
        text: expect.stringContaining('https://mock-gateway.link/ipfs/bafyTest456')
      });
    });
    
    it('should use default gateway URL when not provided in config', async () => {
      const mockMessage = { content: { text: 'Get file with CID QmTest123' } };
      const mockCIDs = ['QmTest123'];
      (getCIDsFromMessage as any).mockReturnValue(mockCIDs);
      (validateStorageClientConfig as any).mockResolvedValue({});
      
      const result = await retrieveAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith({
        text: expect.stringContaining(`${defaultGatewayUrl}/ipfs/QmTest123`)
      });
    });

    it('should handle errors properly', async () => {
      const mockMessage = { content: { text: 'Get file with CID QmTest123' } };
      const mockCIDs = ['QmTest123'];
      (getCIDsFromMessage as any).mockReturnValue(mockCIDs);
      
      (validateStorageClientConfig as any).mockResolvedValue({
        GATEWAY_URL: 'https://mock-gateway.link'
      });
      
      mockCallback.mockImplementationOnce(() => {
        throw new Error('Simulated error during callback');
      });
      
      const result = await retrieveAction.handler(
        mockRuntime,
        mockMessage as any,
        {} as any,
        {},
        mockCallback
      );
      
      expect(result).toBe(false);
      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenNthCalledWith(2, {
        text: expect.stringContaining('Simulated error during callback')
      });
    });
  });
}); 