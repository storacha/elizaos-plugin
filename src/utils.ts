import { Memory } from '@elizaos/core';
import { CID } from 'multiformats/cid';
import { CarReader } from '@ipld/car';
import { importDAG } from '@ucanto/core/delegation';

export const defaultGatewayUrl = "https://w3s.link";

export const getCIDsFromMessage = (message: Memory) => {
    if (!message?.content?.text) {
        return [];
    }

    // Patterns for potential CIDs:
    // - v0 CIDs start with Qm and are 46 characters in base58
    // - v1 CIDs commonly start with b for various base encodings (often bafy, bafk, etc.)
    const cidPattern = /(Qm[a-zA-Z0-9]{44}|b[a-zA-Z0-9]{1,})/g;
    const matches = message.content.text.match(cidPattern);
    const cids: string[] = [];
    
    if (matches) {
        for (const match of matches) {
            try {
                const cid = CID.parse(match);
                // Accept both v0 and v1 CIDs
                if (cid.version === 0 || cid.version === 1) {
                    cids.push(cid.toString());
                }
            } catch (error) {
                // We can ignore this error as it's not a valid CID
            }
        }
    }
    return cids;
}


/**
 * Parses a delegation from a base64 encoded CAR file
 * @param data - The base64 encoded CAR file
 * @returns The parsed delegation
 */
export const parseDelegation = async (data: string) => {
    const blocks = []
    const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'))
    for await (const block of reader.blocks()) {
        blocks.push(block)
    }
    return importDAG(blocks)
}
