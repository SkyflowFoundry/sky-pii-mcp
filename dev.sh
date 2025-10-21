#!/bin/bash

# Create a temporary file to capture inspector output
TEMP_LOG=$(mktemp)

# Start inspector in background without auto-opening browser
# Redirect output to both the temp file and stdout
MCP_AUTO_OPEN_ENABLED=false npx -y @modelcontextprotocol/inspector 2>&1 | tee "$TEMP_LOG" &
INSPECTOR_PID=$!

# Wait for the ready message
timeout=30
elapsed=0
while [ $elapsed -lt $timeout ]; do
  if grep -q "MCP Inspector is up and running" "$TEMP_LOG"; then
    echo "✓ Inspector is ready!"
    break
  fi
  sleep 0.5
  elapsed=$((elapsed + 1))
done

# Extract the MCP_PROXY_AUTH_TOKEN from the inspector output
TOKEN=$(grep -o 'MCP_PROXY_AUTH_TOKEN=[a-f0-9]*' "$TEMP_LOG" | cut -d'=' -f2)

# Clean up temp file
rm -f "$TEMP_LOG"

# Open browser with pre-configured URL including the proxy auth token
if [ -n "$TOKEN" ]; then
  open "http://localhost:6274/?transport=streamable-http&serverUrl=http://localhost:3000/mcp&MCP_PROXY_AUTH_TOKEN=$TOKEN"
else
  echo "⚠️  Warning: Could not extract MCP_PROXY_AUTH_TOKEN, opening browser without it"
  open 'http://localhost:6274/?transport=streamable-http&serverUrl=http://localhost:3000/mcp'
fi

# Start the server in foreground
npx -y tsx src/server.ts
