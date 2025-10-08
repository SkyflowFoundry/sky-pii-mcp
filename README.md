# Sky Deidentify MCP

A streamable HTTP MCP (Model Context Protocol) server built with TypeScript, Express, and the official MCP SDK.

## Overview

This server demonstrates how to build a remote MCP server using the Streamable HTTP transport. It exposes tools and resources that can be accessed by MCP clients like Claude Desktop.

### Features

- **Tools**: Addition tool for adding two numbers
- **Resources**: Dynamic greeting resource with template URI support
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

### Environment Variables

- `PORT`: Server port (default: 3000)

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
3. The `add` tool should now be available in Claude Desktop

## Architecture

- **Express Server**: Handles HTTP requests on the `/mcp` endpoint
- **MCP Server**: Registers tools and resources using the official SDK
- **Streamable HTTP Transport**: Creates a new transport per request to prevent ID collisions
- **Session Management**: Each request gets its own isolated transport instance

## Dependencies

- `@modelcontextprotocol/sdk`: Official MCP TypeScript SDK
- `express`: Web server framework
- `zod`: Schema validation for tool inputs/outputs

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Streamable HTTP Transport Guide](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http)

