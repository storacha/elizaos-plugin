import { describe, it, expect, vi } from 'vitest';
import { getCIDsFromMessage, defaultGatewayUrl } from '../src/utils';
import { CID } from 'multiformats/cid';

// Mock CID.parse to validate our test cases properly
vi.mock('multiformats/cid', () => ({
  CID: {
    parse: vi.fn((cidStr) => {
      if (cidStr.startsWith('Qm') && cidStr.length === 46) {
        return { version: 0, toString: () => cidStr };
      } else if (cidStr.startsWith('b') && cidStr.length > 1) {
        return { version: 1, toString: () => cidStr };
      }
      throw new Error('Invalid CID');
    })
  }
}));

describe('utils', () => {
  describe('getCIDsFromMessage', () => {
    it('should return an empty array for null or empty messages', () => {
      expect(getCIDsFromMessage(null as any)).toEqual([]);
      expect(getCIDsFromMessage({ content: null } as any)).toEqual([]);
      expect(getCIDsFromMessage({ content: { text: null } } as any)).toEqual([]);
      expect(getCIDsFromMessage({ content: { text: '' } } as any)).toEqual([]);
    });

    it('should extract v0 CIDs (Qm...) from messages', () => {
      const v0CID = 'QmPK1s3pShm2soXLzSGBeq3cenH2G6AzF1dzQdLgc5Rv78';
      const message = { content: { text: `Here is a v0 CID: ${v0CID}` } };
      
      const result = getCIDsFromMessage(message as any);
      
      expect(result).toContain(v0CID);
      expect(CID.parse).toHaveBeenCalledWith(v0CID);
    });

    it('should extract v1 CIDs (bafy..., bafk...) from messages', () => {
      const v1CIDs = [
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        'bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy'
      ];
      
      const message = { 
        content: { 
          text: `Here are v1 CIDs: ${v1CIDs[0]} and ${v1CIDs[1]}` 
        } 
      };
      
      const result = getCIDsFromMessage(message as any);
      
      expect(result).toContain(v1CIDs[0]);
      expect(result).toContain(v1CIDs[1]);
      expect(CID.parse).toHaveBeenCalledWith(v1CIDs[0]);
      expect(CID.parse).toHaveBeenCalledWith(v1CIDs[1]);
    });

    it('should extract both v0 and v1 CIDs from messages', () => {
      const v0CID = 'QmPK1s3pShm2soXLzSGBeq3cenH2G6AzF1dzQdLgc5Rv78';
      const v1CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      
      const message = { 
        content: { 
          text: `Here are CIDs: ${v0CID} and ${v1CID}` 
        } 
      };
      
      const result = getCIDsFromMessage(message as any);
      
      expect(result).toContain(v0CID);
      expect(result).toContain(v1CID);
    });

    it('should ignore invalid CIDs or strings that are not CIDs', () => {
      const validCID = 'QmPK1s3pShm2soXLzSGBeq3cenH2G6AzF1dzQdLgc5Rv78';
      const invalidStrings = [
        'QmInvalid', // Too short for v0
        'baf123',    // Not a valid v1 CID format
        'regularword',
        '12345'
      ];
      
      const message = { 
        content: { 
          text: `Valid CID: ${validCID}. Invalid: ${invalidStrings.join(', ')}` 
        } 
      };
      
      (CID.parse as any).mockImplementation((cidStr) => {
        if (cidStr === validCID) {
          return { version: 0, toString: () => cidStr };
        }
        throw new Error('Invalid CID');
      });
      
      const result = getCIDsFromMessage(message as any);
      
      expect(result).toEqual([validCID]);
      expect(result.length).toBe(1);
    });
  });

  describe('defaultGatewayUrl', () => {
    it('should be the correct URL', () => {
      expect(defaultGatewayUrl).toBe('https://w3s.link');
    });
  });
}); 