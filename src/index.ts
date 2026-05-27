import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { LuaBridge } from './lua-bridge.js';
import { cloneOrPull, verifyPob2, getPob2SrcDir } from './pob-manager.js';
import { toolDefinitions, dispatchTool } from './tools/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIM_PATH = path.resolve(__dirname, '..', 'lua', 'pob-shim.lua');
const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  console.log('poe2-mcp starting…');

  const cloneResult = await cloneOrPull();
  console.log(`pob2: ${cloneResult.action} @ ${cloneResult.head}`);
  await verifyPob2();

  const bridge = new LuaBridge(getPob2SrcDir(), SHIM_PATH);
  await bridge.spawn();
  console.log('lua bridge ready');

  const server = new Server(
    { name: 'poe2-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, bridge, args);
  });

  const app = express();
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  app.all('/mcp', async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  await server.connect(transport);

  app.listen(PORT, () => {
    console.log(`poe2-mcp listening on http://localhost:${PORT}/mcp`);
  });

  process.on('SIGINT', () => {
    bridge.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('startup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
