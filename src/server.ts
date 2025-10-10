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
  DeidentifyFileOptions,
  DeidentifyFileRequest,
  FileInput,
  TokenFormat,
  TokenType,
  Skyflow,
  SkyflowError,
  DetectEntities,
  MaskingMethod,
  DetectOutputTranscription,
  Bleep,
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

// Add a Skyflow Deidentify File tool
server.registerTool(
  "deidentify_file",
  {
    title: "Skyflow Deidentify File Tool",
    description:
      "Deidentify sensitive information in files (images, PDFs, audio, documents) using Skyflow. Accepts base64-encoded file data and returns the processed file with sensitive data redacted or masked.",
    inputSchema: {
      fileData: z.string().min(1).describe("Base64-encoded file content"),
      fileName: z.string().describe("Original filename for type detection"),
      mimeType: z.string().optional().describe("MIME type of the file (e.g., image/png, audio/mp3)"),
      entities: z.array(z.enum([
        "age",
        "bank_account",
        "credit_card",
        "credit_card_expiration",
        "cvv",
        "date",
        "date_interval",
        "dob",
        "driver_license",
        "email_address",
        "healthcare_number",
        "ip_address",
        "location",
        "name",
        "numerical_pii",
        "phone_number",
        "ssn",
        "url",
        "vehicle_id",
        "medical_code",
        "name_family",
        "name_given",
        "account_number",
        "event",
        "filename",
        "gender",
        "language",
        "location_address",
        "location_city",
        "location_coordinate",
        "location_country",
        "location_state",
        "location_zip",
        "marital_status",
        "money",
        "name_medical_professional",
        "occupation",
        "organization",
        "organization_medical_facility",
        "origin",
        "passport_number",
        "password",
        "physical_attribute",
        "political_affiliation",
        "religion",
        "time",
        "username",
        "zodiac_sign",
        "blood_type",
        "condition",
        "dose",
        "drug",
        "injury",
        "medical_process",
        "statistics",
        "routing_number",
        "corporate_action",
        "financial_metric",
        "product",
        "trend",
        "duration",
        "location_address_street",
        "all",
        "sexuality",
        "effect",
        "project",
        "organization_id",
        "day",
        "month",
        "year"
      ])).optional().describe("Specific entities to detect. Leave empty to detect all supported entities."),
      maskingMethod: z.enum(["BLACKBOX", "PIXELATE", "BLUR", "REDACT"]).optional().describe("Masking method for images"),
      outputProcessedFile: z.boolean().optional().describe("Whether to include the processed file in the response"),
      outputOcrText: z.boolean().optional().describe("For images/PDFs: include OCR text in response"),
      outputTranscription: z.enum(["PLAINTEXT_TRANSCRIPTION", "REDACTED_TRANSCRIPTION"]).optional().describe("For audio: type of transcription"),
      pixelDensity: z.number().optional().describe("For PDFs: pixel density (default 300)"),
      maxResolution: z.number().optional().describe("For PDFs: max resolution (default 2000)"),
      waitTime: z.number().optional().describe("Wait time for response in seconds (max 64)"),
    },
    outputSchema: {
      processedFileData: z.string().optional().describe("Base64-encoded processed file"),
      mimeType: z.string().optional().describe("MIME type of the processed file"),
      extension: z.string().optional().describe("File extension of the processed file"),
      detectedEntities: z.array(z.object({
        file: z.string().describe("Base64-encoded file with redacted entity"),
        extension: z.string().describe("File extension"),
      })).optional().describe("List of detected entities as separate files"),
      wordCount: z.number().optional().describe("Number of words processed"),
      charCount: z.number().optional().describe("Number of characters processed"),
      sizeInKb: z.number().optional().describe("Size of processed file in KB"),
      durationInSeconds: z.number().optional().describe("Duration for audio files in seconds"),
      pageCount: z.number().optional().describe("Number of pages for documents"),
      slideCount: z.number().optional().describe("Number of slides for presentations"),
      runId: z.string().optional().describe("Run ID for async operations"),
      status: z.string().optional().describe("Status of the operation"),
    },
  },
  async ({ fileData, fileName, mimeType, entities, maskingMethod, outputProcessedFile, outputOcrText, outputTranscription, pixelDensity, maxResolution, waitTime }) => {
    try {
      // Decode base64 to buffer
      const buffer = Buffer.from(fileData, "base64");

      // Create a File object from the buffer
      const file = new File([buffer], fileName, { type: mimeType });

      // Construct the file input
      const fileInput: FileInput = { file: file };
      const fileReq = new DeidentifyFileRequest(fileInput);

      // Configure DeidentifyFileOptions
      const options = new DeidentifyFileOptions();

      // Set entities if provided
      if (entities && entities.length > 0) {
        // Map string entity names to DetectEntities enum values
        const entityEnums = entities.map(e => {
          const entityKey = e.toUpperCase().replace(/-/g, "_");
          return (DetectEntities as any)[entityKey] || e;
        });
        options.setEntities(entityEnums);
      }

      // Set masking method for images
      if (maskingMethod) {
        const maskingKey = maskingMethod.toUpperCase();
        const maskingEnum = (MaskingMethod as any)[maskingKey];
        if (maskingEnum) {
          options.setMaskingMethod(maskingEnum);
        }
      }

      // Set output options
      if (outputProcessedFile !== undefined) {
        if (mimeType?.startsWith("image/")) {
          options.setOutputProcessedImage(outputProcessedFile);
        } else if (mimeType?.startsWith("audio/")) {
          options.setOutputProcessedAudio(outputProcessedFile);
        }
      }

      if (outputOcrText) {
        options.setOutputOcrText(outputOcrText);
      }

      if (outputTranscription) {
        const transcriptionKey = outputTranscription.toUpperCase();
        const transcriptionEnum = (DetectOutputTranscription as any)[transcriptionKey];
        if (transcriptionEnum) {
          options.setOutputTranscription(transcriptionEnum);
        }
      }

      if (pixelDensity) {
        options.setPixelDensity(pixelDensity);
      }

      if (maxResolution) {
        options.setMaxResolution(maxResolution);
      }

      // Set wait time (default to 64 seconds max, or use provided value)
      options.setWaitTime(waitTime || 64);

      // Call deidentifyFile - need to get vaultId from environment
      const vaultId = process.env.VAULT_ID || "";
      const response = await skyflow
        .detect(vaultId)
        .deidentifyFile(fileReq, options);

      // Prepare the output
      const output: any = {};

      // If there's a processed file base64, include it
      if (response.fileBase64) {
        output.processedFileData = response.fileBase64;
      }

      // Include file metadata
      if (response.type) {
        output.mimeType = response.type;
      }

      if (response.extension) {
        output.extension = response.extension;
      }

      // Add detected entities if available
      if (response.entities && response.entities.length > 0) {
        output.detectedEntities = response.entities.map((e: any) => ({
          file: e.file,
          extension: e.extension,
        }));
      }

      // Add file statistics
      if (response.wordCount !== undefined) {
        output.wordCount = response.wordCount;
      }

      if (response.charCount !== undefined) {
        output.charCount = response.charCount;
      }

      if (response.sizeInKb !== undefined) {
        output.sizeInKb = response.sizeInKb;
      }

      if (response.durationInSeconds !== undefined) {
        output.durationInSeconds = response.durationInSeconds;
      }

      if (response.pageCount !== undefined) {
        output.pageCount = response.pageCount;
      }

      if (response.slideCount !== undefined) {
        output.slideCount = response.slideCount;
      }

      // Include run ID and status if this was an async operation
      if (response.runId) {
        output.runId = response.runId;
        output.status = response.status;
      }

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    } catch (error) {
      if (error instanceof SkyflowError) {
        const errorOutput = {
          error: true,
          code: error.error?.http_code,
          message: error.message,
          details: error.error?.details,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(errorOutput) }],
          isError: true,
        };
      } else {
        const errorOutput = {
          error: true,
          message: error instanceof Error ? error.message : "Unknown error occurred",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(errorOutput) }],
          isError: true,
        };
      }
    }
  }
);

const app = express();
app.use(express.json({ limit: "50mb" })); // Increase limit for base64-encoded files

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
