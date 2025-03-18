// src/actions/upload.ts
import { elizaLogger as elizaLogger3 } from "@elizaos/core";
import fs from "fs";

// src/environments.ts
import { elizaLogger } from "@elizaos/core";
import { z } from "zod";
var storageClientEnvSchema = z.object({
  STORACHA_AGENT_PRIVATE_KEY: z.string().min(1, "Storacha agent private key is required").describe(`The private key of the agent that is used to sign data before uploading to the Storacha network.
                  This is the base64 encoded private key string.
                  You can install and sign up for a Storacha account using the CLI https://docs.storacha.network/w3cli
                  And then create a private key for your agent:
                  - https://github.com/storacha/upload-service/blob/main/packages/cli/README.md#storacha-agent-create-private-key`),
  STORACHA_AGENT_DELEGATION: z.string().min(1, "Storacha agent delegation is required").describe(`The delegation that authorizes the Agent to upload data to the Storacha network.
                  This is the base64 encoded delegation string.
                  You can install and sign up for a Storacha account using the CLI https://docs.storacha.network/w3cli
                  And then create a delegation for your agent:
                  - https://docs.storacha.network/concepts/ucan/#delegate-across-apps-and-services
                  - https://github.com/storacha/upload-service/blob/main/packages/cli/README.md#storacha-delegation-create-audience-did`),
  GATEWAY_URL: z.string().nullable().default("https://w3s.link").describe("The gateway URL to use for fetching data from the network. Defaults to https://w3s.link")
});
async function validateStorageClientConfig(runtime) {
  try {
    const config = {
      STORACHA_AGENT_PRIVATE_KEY: runtime.getSetting("STORACHA_AGENT_PRIVATE_KEY"),
      STORACHA_AGENT_DELEGATION: runtime.getSetting("STORACHA_AGENT_DELEGATION"),
      GATEWAY_URL: runtime.getSetting("GATEWAY_URL")
    };
    const c = storageClientEnvSchema.parse(config);
    return c;
  } catch (error) {
    elizaLogger.error("Storage client config validation failed", error);
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Storage client configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/utils.ts
import { CID } from "multiformats/cid";
import { CarReader } from "@ipld/car";
import { importDAG } from "@ucanto/core/delegation";
var defaultGatewayUrl = "https://w3s.link";
var getCIDsFromMessage = (message) => {
  var _a;
  if (!((_a = message == null ? void 0 : message.content) == null ? void 0 : _a.text)) {
    return [];
  }
  const cidPattern = /(Qm[a-zA-Z0-9]{44}|b[a-zA-Z0-9]{1,})/g;
  const matches = message.content.text.match(cidPattern);
  const cids = [];
  if (matches) {
    for (const match of matches) {
      try {
        const cid = CID.parse(match);
        if (cid.version === 0 || cid.version === 1) {
          cids.push(cid.toString());
        }
      } catch (error) {
      }
    }
  }
  return cids;
};
var parseDelegation = async (data) => {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, "base64"));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return importDAG(blocks);
};

// src/clients/storage.ts
import * as Storage from "@web3-storage/w3up-client";
import { elizaLogger as elizaLogger2 } from "@elizaos/core";
import { StoreMemory } from "@web3-storage/w3up-client/stores/memory";
import { Signer } from "@ucanto/principal/ed25519";
var StorageClientInstanceImpl = class {
  runtime;
  storage = null;
  config = null;
  constructor(runtime) {
    this.runtime = runtime;
  }
  async start() {
    try {
      if (this.storage) {
        elizaLogger2.info("Storage client already initialized");
        return;
      }
      this.config = await validateStorageClientConfig(this.runtime);
      this.storage = await createStorageClient(this.config);
      elizaLogger2.success(`\u2705 Storage client successfully started`);
    } catch (error) {
      elizaLogger2.error(`\u274C Storage client failed to start: ${error}`);
      throw error;
    }
  }
  async stop(runtime) {
    this.storage = null;
    this.config = null;
  }
  getStorage() {
    if (!this.storage) {
      throw new Error("Storage client not initialized");
    }
    return this.storage;
  }
  getConfig() {
    if (!this.config) {
      throw new Error("Storage client not initialized");
    }
    return this.config;
  }
  getGatewayUrl() {
    var _a;
    return ((_a = this.config) == null ? void 0 : _a.GATEWAY_URL) || defaultGatewayUrl;
  }
  getContent(cid) {
    return fetch(`${this.getGatewayUrl()}/ipfs/${cid}`);
  }
};
var StorageClientInterface = {
  name: "storage",
  start: async (runtime) => {
    const storageClient = new StorageClientInstanceImpl(runtime);
    await storageClient.start();
    return storageClient;
  }
};
var createStorageClient = async (config) => {
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
};

// src/actions/upload.ts
var uploadAction = {
  name: "STORAGE_UPLOAD",
  similes: ["UPLOAD", "STORE", "SAVE", "PUT", "PIN"],
  description: "Use this action when the user wants to upload a file to Storacha distributed storage network.",
  validate: async (runtime) => {
    await validateStorageClientConfig(runtime);
    return true;
  },
  handler: async (runtime, message, state, options, callback) => {
    const attachments = message.content.attachments;
    if (attachments && attachments.length === 0) {
      elizaLogger3.error("No file to upload.");
      callback == null ? void 0 : callback({
        text: "Looks like you didn't attach any files. Please attach a file and try again.",
        action: null
      });
      return false;
    }
    if (callback) {
      await callback({
        text: "Sure thing! Starting the engines, hold on tight. Uploading file(s) to Storacha...",
        action: null
      });
    }
    try {
      elizaLogger3.info("Uploading file(s) to Storacha...");
      const config = await validateStorageClientConfig(runtime);
      const storageClient = await createStorageClient(config);
      if (!storageClient) {
        elizaLogger3.error("Error initializing Storacha storage client");
        await (callback == null ? void 0 : callback({
          text: "I'm sorry, I couldn't initialize the Storacha storage client. Please try again later.",
          content: { error: "Error initializing Storacha storage client" }
        }));
        return false;
      }
      const files = attachments.map((attached) => {
        const fileContent = fs.readFileSync(attached.url);
        const blob = new Blob([fileContent], { type: attached.contentType });
        const file = new File([blob], attached.title, { type: attached.contentType });
        return file;
      });
      const directoryLink = await storageClient.uploadDirectory(files, {
        retries: 3,
        concurrentRequests: 3,
        pieceHasher: null,
        // Indicates to not store data in Filecoin
        onUploadProgress: (progress) => {
          elizaLogger3.info(`Uploading file(s) to Storacha... ${progress}%`);
        }
      });
      const gatewayUrl = config.GATEWAY_URL || defaultGatewayUrl;
      const link = `${gatewayUrl}/ipfs/${directoryLink.link().toString()}`;
      elizaLogger3.info(`Uploaded file(s) to Storacha. Link: ${link}`);
      await (callback == null ? void 0 : callback({
        text: `Here you go! You can access the file(s) at the following link: ${link}`,
        action: null
      }));
      elizaLogger3.success("File(s) uploaded to Storacha");
      return true;
    } catch (error) {
      elizaLogger3.error("Error uploading file(s) to Storacha", error);
      await (callback == null ? void 0 : callback({
        text: "I'm sorry, I couldn't upload the file(s) to Storacha. Please try again later.",
        content: { error: error.message }
      }));
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "can you upload this file?"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll help you upload this file to a decentralized storage network.",
          action: "STORAGE_UPLOAD"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: `The files have been uploaded. You can access them at the following link: https://w3s.link/ipfs/QmHash1}`,
          action: null
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "store this document in Storacha please"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll help you store that document in Storacha storage.",
          action: "STORAGE_UPLOAD"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: `The files have been uploaded. You can access them at the following link: https://w3s.link/ipfs/QmHash1}`,
          action: null
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "save this image for me"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll help you save that image to Storacha storage.",
          action: "STORAGE_UPLOAD"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: `The image has been uploaded. You can access it at the following link: https://w3s.link/ipfs/QmHash1}`,
          action: null
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "pin this image into IPFS"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll help you pin that image into IPFS using Storacha.",
          action: "STORAGE_UPLOAD"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: `The files have been pinned. You can access them at the following link: https://w3s.link/ipfs/QmHash1}`,
          action: null
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "pin this file into IPFS"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "I'll help you pin that file into IPFS using Storacha.",
          action: "STORAGE_UPLOAD"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: `The files have been pinned. You can access them at the following link: https://w3s.link/ipfs/QmHash1}`,
          action: null
        }
      }
    ]
  ]
};

// src/actions/retrieve.ts
import {
  elizaLogger as elizaLogger4
} from "@elizaos/core";
var retrieveAction = {
  name: "STORAGE_RETRIEVE",
  similes: [
    "RETRIEVE",
    "RETRIEVE_FILE",
    "RETRIEVE_FILE_FROM_STORAGE",
    "RETRIEVE_FILE_FROM_IPFS",
    "GET",
    "GET_FILE",
    "GET_FILE_FROM_STORAGE",
    "GET_FILE_FROM_IPFS",
    "GET_FILE_FROM_CID",
    "LOAD",
    "LOAD_FILE",
    "LOAD_FILE_FROM_STORAGE",
    "LOAD_FILE_FROM_IPFS",
    "LOAD_FILE_FROM_CID",
    "READ",
    "READ_FILE",
    "READ_FILE_FROM_STORAGE",
    "READ_FILE_FROM_IPFS",
    "READ_FILE_FROM_CID"
  ],
  validate: async (runtime, _message) => {
    elizaLogger4.log("Starting STORAGE_RETRIEVE validate...");
    await validateStorageClientConfig(runtime);
    return true;
  },
  description: "Retrieve a file from the Storacha network. Use this action when a user asks you to retrieve a file from the Storacha network based on a CID.",
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger4.log("Starting STORAGE_RETRIEVE handler...");
    const cids = getCIDsFromMessage(message);
    if (cids.length === 0) {
      await (callback == null ? void 0 : callback({ text: "You didn't provide any CIDs to retrieve the content." }));
      return false;
    }
    const config = await validateStorageClientConfig(runtime);
    try {
      elizaLogger4.log("Retrieving file(s) from storage...");
      const gatewayUrl = config.GATEWAY_URL || defaultGatewayUrl;
      const files = cids.map((cid, idx) => {
        return {
          url: `${gatewayUrl}/ipfs/${cid}`,
          title: `File ${idx + 1}`
        };
      });
      await (callback == null ? void 0 : callback({
        text: `The file(s) you requested are ready to be downloaded. 

${files.map((file) => `- ${file.url}`).join("\n")}`
      }));
      elizaLogger4.log("File(s) retrieved successfully!");
      return true;
    } catch (error) {
      elizaLogger4.error("Error during retrieve file(s) from storage:", error);
      await (callback == null ? void 0 : callback({ text: `Error during retrieve file(s) from storage: ${error.message}` }));
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Retrieve the file with CID: QmS4ghgMgfFvqPjB4WKXHaN15ZyT4K4JY8Y4K3Y4K3Y4K3Y"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok, I'll get it for you. Just a moment..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Fetch the file QmS4ghgMgfFvqPjB4WKXHaN15ZyT4K4JY8Y4K3Y4K3Y4K3Y"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok, I'll get it for you. Just a second..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Get the file QmS4ghgMgfFvqPjB4WKXHaN15ZyT4K4JY8Y4K3Y4K3Y4K3Y"
        }
      },
      {
        user: "{{agent}}",
        content: {
          text: "Ok, I'll get it for you. Hold on..."
        }
      }
    ]
  ]
};

// src/index.ts
var PluginName = "storage";
var storagePlugin = {
  name: PluginName,
  description: "Plugin to manage files in a decentralized storage network",
  config: storageClientEnvSchema,
  actions: [uploadAction, retrieveAction],
  clients: [StorageClientInterface],
  services: [],
  evaluators: [],
  providers: []
};
var getStorageClient = async (runtime) => {
  const storagePlugin2 = runtime.plugins.find((plugin) => plugin.name === PluginName);
  if (storagePlugin2 && storagePlugin2.clients && storagePlugin2.clients.length > 0) {
    const [storageStarter] = storagePlugin2.clients;
    if (storageStarter) {
      const storageClient = await storageStarter.start(runtime);
      return storageClient;
    }
  }
  throw new Error("Storage client not found in runtime");
};
var index_default = storagePlugin;
export {
  StorageClientInstanceImpl as StorageClientImpl,
  StorageClientInterface,
  index_default as default,
  getStorageClient,
  storagePlugin
};
//# sourceMappingURL=index.js.map