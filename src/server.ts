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
} from "skyflow-node";
import { AsyncLocalStorage } from "async_hooks";

/** Default maximum wait time for file dehydration operations (in seconds) */
const DEFAULT_MAX_WAIT_TIME_SECONDS = 64;

/**
 * Type-safe mapping from string entity names to DetectEntities enum values.
 * This ensures proper type checking and prevents runtime errors from invalid entity mappings.
 */
const ENTITY_MAP: Record<string, DetectEntities> = {
  age: DetectEntities.AGE,
  bank_account: DetectEntities.BANK_ACCOUNT,
  credit_card: DetectEntities.CREDIT_CARD,
  credit_card_expiration: DetectEntities.CREDIT_CARD_EXPIRATION,
  cvv: DetectEntities.CVV,
  date: DetectEntities.DATE,
  date_interval: DetectEntities.DATE_INTERVAL,
  dob: DetectEntities.DOB,
  driver_license: DetectEntities.DRIVER_LICENSE,
  email_address: DetectEntities.EMAIL_ADDRESS,
  healthcare_number: DetectEntities.HEALTHCARE_NUMBER,
  ip_address: DetectEntities.IP_ADDRESS,
  location: DetectEntities.LOCATION,
  name: DetectEntities.NAME,
  numerical_pii: DetectEntities.NUMERICAL_PII,
  phone_number: DetectEntities.PHONE_NUMBER,
  ssn: DetectEntities.SSN,
  url: DetectEntities.URL,
  vehicle_id: DetectEntities.VEHICLE_ID,
  medical_code: DetectEntities.MEDICAL_CODE,
  name_family: DetectEntities.NAME_FAMILY,
  name_given: DetectEntities.NAME_GIVEN,
  account_number: DetectEntities.ACCOUNT_NUMBER,
  event: DetectEntities.EVENT,
  filename: DetectEntities.FILENAME,
  gender: DetectEntities.GENDER,
  language: DetectEntities.LANGUAGE,
  location_address: DetectEntities.LOCATION_ADDRESS,
  location_city: DetectEntities.LOCATION_CITY,
  location_coordinate: DetectEntities.LOCATION_COORDINATE,
  location_country: DetectEntities.LOCATION_COUNTRY,
  location_state: DetectEntities.LOCATION_STATE,
  location_zip: DetectEntities.LOCATION_ZIP,
  marital_status: DetectEntities.MARITAL_STATUS,
  money: DetectEntities.MONEY,
  name_medical_professional: DetectEntities.NAME_MEDICAL_PROFESSIONAL,
  occupation: DetectEntities.OCCUPATION,
  organization: DetectEntities.ORGANIZATION,
  organization_medical_facility: DetectEntities.ORGANIZATION_MEDICAL_FACILITY,
  origin: DetectEntities.ORIGIN,
  passport_number: DetectEntities.PASSPORT_NUMBER,
  password: DetectEntities.PASSWORD,
  physical_attribute: DetectEntities.PHYSICAL_ATTRIBUTE,
  political_affiliation: DetectEntities.POLITICAL_AFFILIATION,
  religion: DetectEntities.RELIGION,
  time: DetectEntities.TIME,
  username: DetectEntities.USERNAME,
  zodiac_sign: DetectEntities.ZODIAC_SIGN,
  blood_type: DetectEntities.BLOOD_TYPE,
  condition: DetectEntities.CONDITION,
  dose: DetectEntities.DOSE,
  drug: DetectEntities.DRUG,
  injury: DetectEntities.INJURY,
  medical_process: DetectEntities.MEDICAL_PROCESS,
  statistics: DetectEntities.STATISTICS,
  routing_number: DetectEntities.ROUTING_NUMBER,
  corporate_action: DetectEntities.CORPORATE_ACTION,
  financial_metric: DetectEntities.FINANCIAL_METRIC,
  product: DetectEntities.PRODUCT,
  trend: DetectEntities.TREND,
  duration: DetectEntities.DURATION,
  location_address_street: DetectEntities.LOCATION_ADDRESS_STREET,
  all: DetectEntities.ALL,
  sexuality: DetectEntities.SEXUALITY,
  effect: DetectEntities.EFFECT,
  project: DetectEntities.PROJECT,
  organization_id: DetectEntities.ORGANIZATION_ID,
  day: DetectEntities.DAY,
  month: DetectEntities.MONTH,
  // Note: 'year' entity is not available in the current skyflow-node version
};

/**
 * Type-safe mapping from string masking method names to MaskingMethod enum values.
 */
const MASKING_METHOD_MAP: Record<string, MaskingMethod> = {
  BLACKBOX: MaskingMethod.Blackbox,
  // Note: 'PIXELATE' is not available in the current skyflow-node version
  BLUR: MaskingMethod.Blur,
  // Note: 'REDACT' is not available in the current skyflow-node version
};

/**
 * Type-safe mapping from string transcription names to DetectOutputTranscription enum values.
 */
const TRANSCRIPTION_MAP: Record<string, DetectOutputTranscription> = {
  PLAINTEXT_TRANSCRIPTION: DetectOutputTranscription.PLAINTEXT_TRANSCRIPTION,
  DIARIZED_TRANSCRIPTION: DetectOutputTranscription.DIARIZED_TRANSCRIPTION,
};

/** TypeScript interface for detected entity response items */
interface DetectedEntityItem {
  file: string;
  extension: string;
}

/** TypeScript interface for dehydrate file output */
interface DeidentifyFileOutput {
  [x: string]: unknown;
  processedFileData?: string;
  mimeType?: string;
  extension?: string;
  detectedEntities?: Array<{
    file: string;
    extension: string;
  }>;
  wordCount?: number;
  charCount?: number;
  sizeInKb?: number;
  durationInSeconds?: number;
  pageCount?: number;
  slideCount?: number;
  runId?: string;
  status?: string;
}

/**
 * AsyncLocalStorage for storing per-request Skyflow instances
 * This allows tools to access the current request's Skyflow client
 */
interface RequestContext {
  skyflow: Skyflow;
  vaultId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the Skyflow instance for the current request context
 */
function getCurrentSkyflow(): Skyflow {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new Error("No Skyflow instance available in current request context");
  }
  return context.skyflow;
}

/**
 * Get the vaultId for the current request context
 */
function getCurrentVaultId(): string {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new Error("No vaultId available in current request context");
  }
  return context.vaultId;
}

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

/**
 * Skyflow Dehydrate Tool
 * Replaces sensitive information in text with placeholder tokens
 */
server.registerTool(
  "dehydrate",
  {
    title: "Skyflow Dehydrate Tool",
    description:
      "Dehydrate sensitive information in strings using Skyflow. This tool accepts a string and returns another string, but with placeholders for sensitive data. The placeholders tell you what they are replacing. For example, a credit card number might be replaced with [CREDIT_CARD_abc123].",
    inputSchema: { inputString: z.string().min(1) },
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
    // TODO: add support for custom restrict regex list, include in the tool input schema
    // options.setRestrictRegexList([
    //   "/.{3,}@[a-zA-Z]{2,}\.[a-zA-Z]{2,}/g", // Email addresses with at least 3 characters before '@'
    // ]);
    // TODO: add support for custom allow regex list, include in the tool input schema. Note that allow wins over restrict if the same pattern is in both lists.
    // options.setAllowRegexList([
    //   "/.{3,}@[a-zA-Z]{2,}\.[a-zA-Z]{2,}/g", // Email addresses with at least 3 characters before '@'
    // ]);

    // Get the per-request Skyflow instance
    const skyflow = getCurrentSkyflow();

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

/**
 * Skyflow Rehydrate Tool
 * Restores original sensitive data from dehydrated placeholders
 */
server.registerTool(
  "rehydrate",
  {
    title: "Skyflow Rehydrate Tool",
    description:
      "Rehydrate previously dehydrated sensitive information in strings using Skyflow. This tool accepts a string with redacted placeholders (like [CREDIT_CARD_abc123]) and returns the original sensitive data.",
    inputSchema: { inputString: z.string().min(1) },
    outputSchema: {
      processedText: z.string(),
    },
  },
  async ({ inputString }) => {
    // Get the per-request Skyflow instance
    const skyflow = getCurrentSkyflow();

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

/**
 * Skyflow Dehydrate File Tool
 * Processes files to detect and redact sensitive information
 * Maximum file size: 5MB (due to base64 encoding overhead, original binary files should be ~3.75MB or less)
 */
server.registerTool(
  "dehydrate_file",
  {
    title: "Skyflow Dehydrate File Tool",
    description:
      "Dehydrate sensitive information in files (images, PDFs, audio, documents) using Skyflow. Accepts base64-encoded file data and returns the processed file with sensitive data redacted or masked. Maximum file size: 5MB (base64-encoded). Due to base64 encoding overhead, original binary files should be approximately 3.75MB or smaller.",
    inputSchema: {
      fileData: z.string().min(1).describe("Base64-encoded file content"),
      fileName: z.string().describe("Original filename for type detection"),
      mimeType: z
        .string()
        .optional()
        .describe("MIME type of the file (e.g., image/png, audio/mp3)"),
      entities: z
        .array(
          z.enum([
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
          ])
        )
        .optional()
        .describe(
          "Specific entities to detect. Leave empty to detect all supported entities."
        ),
      maskingMethod: z
        .enum(["BLACKBOX", "BLUR"])
        .optional()
        .describe("Masking method for images (BLACKBOX or BLUR)"),
      outputProcessedFile: z
        .boolean()
        .optional()
        .describe("Whether to include the processed file in the response"),
      outputOcrText: z
        .boolean()
        .optional()
        .describe("For images/PDFs: include OCR text in response"),
      outputTranscription: z
        .enum(["PLAINTEXT_TRANSCRIPTION", "DIARIZED_TRANSCRIPTION"])
        .optional()
        .describe(
          "For audio: type of transcription (PLAINTEXT_TRANSCRIPTION or DIARIZED_TRANSCRIPTION)"
        ),
      pixelDensity: z
        .number()
        .optional()
        .describe("For PDFs: pixel density (default 300)"),
      maxResolution: z
        .number()
        .optional()
        .describe("For PDFs: max resolution (default 2000)"),
      waitTime: z
        .number()
        .min(1)
        .max(64)
        .optional()
        .describe("Wait time for response in seconds (max 64)"),
    },
    outputSchema: {
      processedFileData: z
        .string()
        .optional()
        .describe("Base64-encoded processed file"),
      mimeType: z
        .string()
        .optional()
        .describe("MIME type of the processed file"),
      extension: z
        .string()
        .optional()
        .describe("File extension of the processed file"),
      detectedEntities: z
        .array(
          z.object({
            file: z
              .string()
              .describe("Base64-encoded file with redacted entity"),
            extension: z.string().describe("File extension"),
          })
        )
        .optional()
        .describe("List of detected entities as separate files"),
      wordCount: z.number().optional().describe("Number of words processed"),
      charCount: z
        .number()
        .optional()
        .describe("Number of characters processed"),
      sizeInKb: z.number().optional().describe("Size of processed file in KB"),
      durationInSeconds: z
        .number()
        .optional()
        .describe("Duration for audio files in seconds"),
      pageCount: z
        .number()
        .optional()
        .describe("Number of pages for documents"),
      slideCount: z
        .number()
        .optional()
        .describe("Number of slides for presentations"),
      runId: z.string().optional().describe("Run ID for async operations"),
      status: z.string().optional().describe("Status of the operation"),
    },
  },
  async ({
    fileData,
    fileName,
    mimeType,
    entities,
    maskingMethod,
    outputProcessedFile,
    outputOcrText,
    outputTranscription,
    pixelDensity,
    maxResolution,
    waitTime,
  }) => {
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

      // Set entities if provided - use type-safe mapping
      if (entities && entities.length > 0) {
        const entityEnums = entities.map((e) => {
          const entityEnum = ENTITY_MAP[e];
          if (!entityEnum) {
            throw new Error(`Invalid entity type: ${e}`);
          }
          return entityEnum;
        });
        options.setEntities(entityEnums);
      }

      // Set masking method for images - use type-safe mapping
      if (maskingMethod) {
        const maskingEnum = MASKING_METHOD_MAP[maskingMethod];
        if (!maskingEnum) {
          throw new Error(`Invalid masking method: ${maskingMethod}`);
        }
        options.setMaskingMethod(maskingEnum);
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
        const transcriptionEnum = TRANSCRIPTION_MAP[outputTranscription];
        if (!transcriptionEnum) {
          throw new Error(`Invalid transcription type: ${outputTranscription}`);
        }
        options.setOutputTranscription(transcriptionEnum);
      }

      if (pixelDensity) {
        options.setPixelDensity(pixelDensity);
      }

      if (maxResolution) {
        options.setMaxResolution(maxResolution);
      }

      // Set wait time (default to max, or use provided value)
      options.setWaitTime(waitTime || DEFAULT_MAX_WAIT_TIME_SECONDS);

      // Get the per-request Skyflow instance and vaultId
      const skyflow = getCurrentSkyflow();
      const vaultId = getCurrentVaultId();

      const response = await skyflow
        .detect(vaultId)
        .deidentifyFile(fileReq, options);

      // Prepare the output with proper typing
      const output: DeidentifyFileOutput = {};

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

      // Add detected entities if available with proper typing
      if (response.entities && response.entities.length > 0) {
        output.detectedEntities = response.entities.map(
          (e: DetectedEntityItem) => ({
            file: e.file,
            extension: e.extension,
          })
        );
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
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
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
app.use(express.json({ limit: "5mb" })); // Limit for base64-encoded files

// Landing page route
app.get("/", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skyflow PII MCP Server</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2.5rem 2rem;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.95;
        }

        .content {
            padding: 2.5rem;
        }

        .section {
            margin-bottom: 2.5rem;
        }

        .section:last-child {
            margin-bottom: 0;
        }

        h2 {
            color: #667eea;
            font-size: 1.75rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }

        h3 {
            color: #555;
            font-size: 1.25rem;
            margin: 1.5rem 0 0.75rem;
            font-weight: 600;
        }

        p {
            margin-bottom: 1rem;
            color: #555;
        }

        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 1.25rem;
            margin: 1rem 0;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .code-block pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .inline-code {
            background: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }

        .info-box {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 1.25rem;
            margin: 1.5rem 0;
            border-radius: 4px;
        }

        .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 1.25rem;
            margin: 1.5rem 0;
            border-radius: 4px;
        }

        .cta-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            margin: 2rem 0;
            border-radius: 8px;
            text-align: center;
        }

        .cta-box h3 {
            color: white;
            margin-top: 0;
            font-size: 1.5rem;
        }

        .cta-box p {
            color: rgba(255, 255, 255, 0.95);
            margin-bottom: 1.5rem;
        }

        .btn {
            display: inline-block;
            padding: 0.875rem 2rem;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        ul, ol {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
            color: #555;
        }

        li {
            margin-bottom: 0.5rem;
        }

        .tools-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }

        .tool-card {
            background: #f8f9fa;
            padding: 1.25rem;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }

        .tool-card h4 {
            color: #667eea;
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }

        .tool-card p {
            margin: 0;
            font-size: 0.95rem;
        }

        .footer {
            background: #f8f9fa;
            padding: 1.5rem 2rem;
            text-align: center;
            color: #777;
            border-top: 1px solid #e9ecef;
        }

        .footer a {
            color: #667eea;
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Skyflow PII MCP Server</h1>
            <p>Model Context Protocol server for PII/PHI detection and redaction</p>
        </div>

        <div class="content">
            <div class="section">
                <h2>Available Tools</h2>
                <div class="tools-list">
                    <div class="tool-card">
                        <h4>dehydrate</h4>
                        <p>Detect and redact sensitive information (PII, PHI, etc.) in text</p>
                    </div>
                    <div class="tool-card">
                        <h4>rehydrate</h4>
                        <p>Restore original sensitive data from dehydrated tokens</p>
                    </div>
                    <div class="tool-card">
                        <h4>dehydrate_file</h4>
                        <p>Process files (images, PDFs, audio, documents) to detect and redact sensitive data</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>For Existing Skyflow Customers</h2>
                <p>Connect to this MCP server using your Skyflow credentials. You'll need:</p>
                <ul>
                    <li><strong>Bearer Token:</strong> Your Skyflow API bearer token</li>
                    <li><strong>Vault ID:</strong> Found in your Skyflow dashboard</li>
                    <li><strong>Vault URL:</strong> Your vault's base URL (e.g., <span class="inline-code">https://your-id.vault.skyflowapis.com</span>)</li>
                    <li><strong>Account ID & Workspace ID:</strong> (Optional) Found in your Skyflow settings</li>
                </ul>

                <h3>Claude Desktop Configuration</h3>
                <p>Add this to your <span class="inline-code">claude_desktop_config.json</span>:</p>
                <div class="code-block">
<pre>{
  "mcpServers": {
    "skyflow-pii": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://pii-mcp.dev/mcp?vaultId={your_vault_id}&vaultUrl={your_vault_url}"
      ],
      "headers": {
        "Authorization": "Bearer {your_skyflow_bearer_token}"
      }
    }
  }
}</pre>
                </div>

                <div class="info-box">
                    <strong>💡 Tip:</strong> URL-encode your <span class="inline-code">vaultUrl</span> parameter. For example:<br>
                    <span class="inline-code">https://abc123.vault.skyflowapis.com</span> becomes<br>
                    <span class="inline-code">https%3A%2F%2Fabc123.vault.skyflowapis.com</span>
                </div>

                <h3>Configuration File Locations</h3>
                <ul>
                    <li><strong>macOS:</strong> <span class="inline-code">~/Library/Application Support/Claude/claude_desktop_config.json</span></li>
                    <li><strong>Windows:</strong> <span class="inline-code">%APPDATA%\\Claude\\claude_desktop_config.json</span></li>
                    <li><strong>Linux:</strong> <span class="inline-code">~/.config/Claude/claude_desktop_config.json</span></li>
                </ul>

                <div class="warning-box">
                    <strong>⚠️ Important:</strong> After updating your configuration, restart Claude Desktop completely (quit and reopen) for changes to take effect.
                </div>
            </div>

            <div class="cta-box">
                <h3>New to Skyflow?</h3>
                <p>Skyflow is a data privacy vault that helps you protect sensitive customer data with powerful APIs for detection, tokenization, and de-identification.</p>
                <a href="https://www.skyflow.com/get-demo" class="btn" target="_blank" rel="noopener noreferrer">Get a Free Trial →</a>
            </div>

            <div class="section">
                <h2>Authentication Model</h2>
                <p>This server uses <strong>bearer token pass-through</strong> authentication:</p>
                <ul>
                    <li>Your Skyflow bearer token is forwarded directly to the Skyflow API</li>
                    <li>No tokens are stored on this server</li>
                    <li>Each request can specify different vault configurations</li>
                    <li>Multi-tenant ready - multiple users can use their own credentials</li>
                </ul>
            </div>

            <div class="section">
                <h2>API Endpoint</h2>
                <p>The MCP endpoint is available at:</p>
                <div class="code-block">
<pre>POST ${req.protocol}://${req.get('host')}/mcp</pre>
                </div>
                <p>Query parameters:</p>
                <ul>
                    <li><span class="inline-code">vaultId</span> - Your Skyflow vault ID (required)</li>
                    <li><span class="inline-code">vaultUrl</span> - Your Skyflow vault URL (required)</li>
                    <li><span class="inline-code">accountId</span> - Your Skyflow account ID (optional)</li>
                    <li><span class="inline-code">workspaceId</span> - Your Skyflow workspace ID (optional)</li>
                </ul>
            </div>

            <div class="section">
                <h2>Resources</h2>
                <ul>
                    <li><a href="https://docs.skyflow.com" target="_blank" rel="noopener noreferrer">Skyflow Documentation</a></li>
                    <li><a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol</a></li>
                    <li><a href="https://github.com/skyflowapi" target="_blank" rel="noopener noreferrer">Skyflow GitHub</a></li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>Powered by <a href="https://www.skyflow.com" target="_blank" rel="noopener noreferrer">Skyflow</a> | Built with the <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">Model Context Protocol</a></p>
        </div>
    </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      bearerToken?: string;
    }
  }
}

// Bearer token extraction middleware
// Validates format and extracts token for use with Skyflow API
const authenticateBearer = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token || token.trim().length === 0) {
    return res.status(401).json({ error: "Bearer token is empty" });
  }

  // Attach token to request for downstream use
  req.bearerToken = token;

  next();
};

app.post("/mcp", authenticateBearer, async (req, res) => {
  // Extract query parameters for vault configuration
  const accountId = (req.query.accountId as string) || process.env.ACCOUNT_ID;
  const vaultId = (req.query.vaultId as string) || process.env.VAULT_ID;
  const vaultUrl = (req.query.vaultUrl as string) || process.env.VAULT_URL;
  const workspaceId = (req.query.workspaceId as string) || process.env.WORKSPACE_ID;

  // Validate required parameters
  if (!vaultId) {
    return res.status(400).json({ error: "vaultId is required (provide as query parameter or VAULT_ID environment variable)" });
  }

  if (!vaultUrl) {
    return res.status(400).json({ error: "vaultUrl is required (provide as query parameter or VAULT_URL environment variable)" });
  }

  if (!req.bearerToken) {
    return res.status(401).json({ error: "Bearer token is required" });
  }

  // Extract clusterId from vaultUrl
  const clusterIdMatch = vaultUrl.match(/https:\/\/([^.]+)\.vault/);
  if (!clusterIdMatch || !clusterIdMatch[1]) {
    return res.status(400).json({ error: "Invalid vaultUrl format. Expected format: https://<clusterId>.vault.skyflowapis.com" });
  }
  const clusterId = clusterIdMatch[1];

  // Create per-request Skyflow instance with bearer token
  const skyflowInstance = new Skyflow({
    vaultConfigs: [
      {
        vaultId: vaultId,
        clusterId: clusterId,
        credentials: { token: req.bearerToken },
      },
    ],
  });

  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  // Run the MCP request handling within the AsyncLocalStorage context
  // This makes the Skyflow instance available to all tools via getCurrentSkyflow()
  await requestContextStorage.run(
    { skyflow: skyflowInstance, vaultId: vaultId },
    async () => {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    }
  );
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
