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

### Quick Start

The easiest way to start developing is to use the `dev` script, which automatically starts both the MCP server and inspector with the correct configuration:

```bash
pnpm dev
```

This will:
1. Start the MCP Inspector on port 6274 (UI) and 6277 (proxy)
2. Automatically open your browser with the inspector pre-configured to connect to `http://localhost:3000/mcp`
3. Start your MCP server on port 3000
4. Display interleaved logs from both processes in your terminal

### Available Scripts

- **`pnpm dev`** - Recommended for development. Starts both inspector and server with automatic browser configuration
- **`pnpm server`** - Starts only the MCP server on port 3000
- **`pnpm inspector`** - Starts only the MCP Inspector (useful if you want to run them in separate terminals)

### Manual Setup (Alternative)

If you prefer to run the inspector and server in separate terminals:

1. Copy your Vault Details into `.env.local`
2. In terminal 1, start the inspector:
   ```bash
   pnpm inspector
   ```
3. In terminal 2, start the server:
   ```bash
   pnpm server
   ```
4. Open your browser to `http://localhost:6274/`
5. Choose 'Streamable HTTP' and set the address to `http://localhost:3000/mcp`
6. Click 'Connect'

### Understanding the Ports

- **Port 3000**: Your MCP server (configurable via `PORT` env var)
- **Port 6274**: MCP Inspector UI (where you interact with the inspector)
- **Port 6277**: MCP Inspector Proxy (internal proxy used by the inspector)

### Environment Variables

Create a `.env.local` file with the following variables:

- `SKYFLOW_API_KEY`: Your Skyflow API key (required for authentication)
- `VAULT_ID`: Your Skyflow vault ID
- `VAULT_URL`: Your Skyflow vault URL (e.g., `https://ebfc9bee4242.vault.skyflowapis.com`)
- `PORT`: Server port (default: 3000)
- `REQUIRED_BEARER_TOKEN`: Bearer token for authenticating requests to this MCP server

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

