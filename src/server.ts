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
import crypto from 'crypto';

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

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

// Create a Skyflow vault client
const vaultUrl = process.env.VAULT_URL || "";
const clusterId = vaultUrl.match(/https:\/\/([^.]+)\.vault/)?.[1] || "";

// Use API key for authentication
const apiKey = process.env.SKYFLOW_API_KEY;

if (!apiKey) {
  throw new Error("SKYFLOW_API_KEY environment variable is required");
}

const skyflow = new Skyflow({
  vaultConfigs: [
    {
      vaultId: process.env.VAULT_ID || "",
      clusterId: clusterId,
      credentials: { apiKey: apiKey },
    },
  ],
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

      // Call deidentifyFile - need to get vaultId from environment
      const vaultId = process.env.VAULT_ID || "";
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

// Bearer token authentication middleware
const authenticateBearer = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const requiredToken = process.env.REQUIRED_BEARER_TOKEN;

  if (!requiredToken) {
    console.error("REQUIRED_BEARER_TOKEN not configured");
    return res
      .status(500)
      .json({ error: "Server authentication not configured" });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  const tokensMatch =
    token.length === requiredToken.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(requiredToken));

  if (!tokensMatch) {
    return res.status(403).json({ error: "Invalid bearer token" });
  }

  next();
};

app.post("/mcp", authenticateBearer, async (req, res) => {
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
