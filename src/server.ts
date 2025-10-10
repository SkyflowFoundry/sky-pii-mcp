import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import {
  DeidentifyTextOptions,
  DeidentifyTextRequest,
  ReidentifyTextRequest,
  TokenFormat,
  TokenType,
  Skyflow,
} from "skyflow-node";

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

// Create a Skyflow vault client
const vaultUrl = process.env.VAULT_URL || "";
const clusterId = vaultUrl.match(/https:\/\/([^.]+)\.vault/)?.[1] || "";

const skyflow = new Skyflow({
  vaultConfigs: [
    {
      vaultId: process.env.VAULT_ID || "",
      clusterId: clusterId,
      credentials: {
        token: process.env.SKYFLOW_BEARER_TOKEN || "",
      },
    },
  ],
});

// Add a Skyflow Deidentify tool
server.registerTool(
  "deidentify",
  {
    title: "Skyflow Deidentify Tool",
    description:
      "Deidentify sensitive information in strings using Skyflow. This tool accepts a string and returns another string, but with placeholders for sensitive data. The placeholders tell you what they are replacing. For example, a credit card number might be replaced with [CREDIT_CARD].",
    inputSchema: { inputString: z.string() },
    outputSchema: {
      processedText: z.string(),
      wordCount: z.number(),
      charCount: z.number(),
    },
  },
  async ({ inputString }) => {
    const tokenFormat = new TokenFormat();
    tokenFormat.setDefault(TokenType.VAULT_TOKEN);

    const options = new DeidentifyTextOptions();
    options.setTokenFormat(tokenFormat);

    const response = await skyflow
      .detect()
      .deidentifyText(new DeidentifyTextRequest(inputString), options);

    const output = {
      processedText: response.processedText,
      wordCount: response.wordCount,
      charCount: response.charCount,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  }
);

// Add a Skyflow Reidentify tool
server.registerTool(
  "reidentify",
  {
    title: "Skyflow Reidentify Tool",
    description:
      "Reidentify previously-deidentified sensitive information in strings using Skyflow. This tool accepts a string with redacted placeholders (like [CREDIT_CARD]) and returns the original sensitive data.",
    inputSchema: { inputString: z.string().min(1) },
    outputSchema: {
      processedText: z.string(),
    },
  },
  async ({ inputString }) => {
    const response = await skyflow
      .detect()
      .reidentifyText(new ReidentifyTextRequest(inputString));

    const output = {
      processedText: response.processedText,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  }
);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || "3000");
app
  .listen(port, () => {
    console.log(`Skyflow MCP Server running on http://localhost:${port}/mcp`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
