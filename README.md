# Skyflow PII MCP

A streamable HTTP MCP (Model Context Protocol) server built with TypeScript, Express, and the official MCP SDK.

## Overview

This server demonstrates how to build a remote MCP server using the Streamable HTTP transport. It exposes tools and resources that can be accessed by MCP clients like Claude Desktop.

### Try it out online

This remote MCP server is hosted at `https://pii-mcp.dev/mcp`. If you'd like to try it out contact Skyflow for a key!

### Features

- **Tools**:
  - `add`: Addition tool for adding two numbers
  - `dehydrate`: Skyflow dehydration tool for detecting and redacting sensitive information (PII, PHI, etc.)
- **Resources**:
  - Static `welcome` resource with a welcome message
  - Dynamic `greeting` resource template for personalized greetings
- **Transport**: Streamable HTTP with JSON response support
- **Port**: Configurable via `PORT` environment variable (defaults to 3000)

## Installation

```bash
npm install
# or
pnpm install
```

## Development

Run the server in development mode:

```bash
npx -y tsx src/server.ts
```

The server will start on `http://localhost:3000/mcp` by default.

To start with authentication:

- API Key: `SKYFLOW_API_KEY=your_api_key_here npx -y tsx src/server.ts`
- Bearer Token: `SKYFLOW_BEARER_TOKEN=your_token_here npx -y tsx src/server.ts`

### MCP Inspector

1. Copy your Vault Details into the .env.local
2. Start the inspector server in another terminal:

```
npx -y @modelcontextprotocol/inspector
```

2. Open it at `http://localhost:6274/` (or whatever it says)
3. Choose 'Streamable HTTP' and set the address to `http://localhost:3000/mcp`.
4. Click 'Connect' to connect to the MCP server
5. Success!

### Environment Variables

Create a `.env.local` file with the following variables:

- `SKYFLOW_API_KEY`: Your Skyflow API key (preferred authentication method)
- `SKYFLOW_BEARER_TOKEN`: Your Skyflow API bearer token (used if API key is not provided)
- `VAULT_ID`: Your Skyflow vault ID
- `VAULT_URL`: Your Skyflow vault URL (e.g., `https://ebfc9bee4242.vault.skyflowapis.com`)
- `PORT`: Server port (default: 3000)

**Authentication Priority**: The server will check for `SKYFLOW_API_KEY` first. If it exists and is non-empty, it will be used for authentication. Otherwise, it will fall back to `SKYFLOW_BEARER_TOKEN`.

## Testing

### List Available Tools

Test the MCP server by listing available tools:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Call the Addition Tool

Test calling the `add` tool:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}},"id":2}'
```

### Call the Dehydrate Tool

Test calling the `dehydrate` tool to redact sensitive information:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"dehydrate","arguments":{"inputString":"My email is john.doe@example.com and my SSN is 123-45-6789"}},"id":2}'
```

This will return the dehydrated text with sensitive data redacted, along with word and character counts.

### List Available Resources

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"resources/list","id":3}'
```

### Read a Resource

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"resources/read","params":{"uri":"greeting://Claude"},"id":4}'
```

## Integration with Claude Desktop

To use this MCP server with Claude Desktop, add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sky": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

**Note**: Make sure the server is running before starting Claude Desktop.

### Configuration File Locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

After updating the config:
1. Save the file
2. Restart Claude Desktop completely (quit and reopen)
3. The `add` and `dehydrate` tools should now be available in Claude Desktop

## Architecture

- **Express Server**: Handles HTTP requests on the `/mcp` endpoint
- **MCP Server**: Registers tools and resources using the official SDK
- **Streamable HTTP Transport**: Creates a new transport per request to prevent ID collisions
- **Session Management**: Each request gets its own isolated transport instance

## Dependencies

- `@modelcontextprotocol/sdk`: Official MCP TypeScript SDK
- `express`: Web server framework
- `zod`: Schema validation for tool inputs/outputs
- `skyflow-node`: Skyflow SDK for data privacy and deidentification
- `dotenv`: Environment variable management

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Streamable HTTP Transport Guide](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http)

