import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
// eslint-disable-next-line import/no-unresolved
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// eslint-disable-next-line import/no-unresolved
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './logger';
import { SessionBindingRegistry } from './sessionBindingRegistry';

const MCP_PATH = '/mcp';
const SERVER_NAME = 'arborescent';
const SERVER_VERSION = '0.2.0';

export class ArborescentMcpServer {
  private mcp: McpServer;
  private transport: StreamableHTTPServerTransport;
  private httpServer: http.Server | null = null;
  private port = 0;
  private authToken = '';
  private bindingRegistry = new SessionBindingRegistry();
  private connected = false;

  constructor() {
    this.mcp = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    this.transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    this.registerSmokeTool();
  }

  async start(port: number, authToken: string): Promise<void> {
    if (this.httpServer) {
      throw new Error('MCP server already started');
    }
    if (!authToken) {
      throw new Error('MCP server requires an auth token');
    }
    this.authToken = authToken;

    if (!this.connected) {
      await this.mcp.connect(this.transport);
      this.connected = true;
    }

    this.httpServer = http.createServer((req, res) => this.handle(req, res));

    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.httpServer = null;
        reject(err);
      };
      this.httpServer!.once('error', onError);
      this.httpServer!.listen(port, '127.0.0.1', () => {
        this.httpServer!.removeListener('error', onError);
        const addr = this.httpServer!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        logger.info(`MCP server listening on 127.0.0.1:${this.port}${MCP_PATH}`, 'McpServer');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.httpServer) return;
    const server = this.httpServer;
    this.httpServer = null;
    this.port = 0;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (this.connected) {
      await this.transport.close();
      await this.mcp.close();
      this.connected = false;
    }
    logger.info('MCP server stopped', 'McpServer');
  }

  getPort(): number {
    return this.port;
  }

  getBindingRegistry(): SessionBindingRegistry {
    return this.bindingRegistry;
  }

  private registerSmokeTool(): void {
    this.mcp.registerTool(
      'arborescent.ping',
      {
        title: 'Arborescent ping',
        description: 'Smoke-test tool that confirms the MCP server is reachable.',
      },
      async () => ({
        content: [{ type: 'text', text: 'pong' }],
      })
    );
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!req.url || !req.url.startsWith(MCP_PATH)) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (!this.validateAuth(req)) {
      logger.warn('MCP request rejected: invalid auth token', 'McpServer');
      res.writeHead(401);
      res.end();
      return;
    }

    this.dispatchToTransport(req, res).catch((error) => {
      logger.error('MCP request handler threw', error as Error, 'McpServer');
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }
    });
  }

  private async dispatchToTransport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method?.toUpperCase() ?? 'GET';
    if (method === 'POST') {
      let parsedBody: unknown;
      try {
        parsedBody = await readJsonBody(req);
      } catch (error) {
        logger.warn(`MCP request rejected: malformed JSON body (${(error as Error).message})`, 'McpServer');
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: -32700, message: 'Parse error' } }));
        return;
      }
      await this.transport.handleRequest(req, res, parsedBody);
      return;
    }
    await this.transport.handleRequest(req, res);
  }

  private validateAuth(req: http.IncomingMessage): boolean {
    const header = req.headers.authorization;
    if (!header) return false;
    if (!header.startsWith('Bearer ')) return false;
    const token = header.slice(7);
    if (token.length === 0) return false;
    try {
      const provided = Buffer.from(token);
      const expected = Buffer.from(this.authToken);
      // Length compare is a timing side-channel, but the token is a fixed-format UUID
      // delivered over localhost only. Constant-time compare on equal-length buffers
      // protects the value itself.
      if (provided.length !== expected.length) return false;
      return timingSafeEqual(provided, expected);
    } catch {
      return false;
    }
  }
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on('error', reject);
  });
}

export async function startMcpServerWithRetry(
  basePort: number,
  authToken: string,
  maxRetries = 3
): Promise<{ server: ArborescentMcpServer | null; port: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const port = basePort + attempt;
    const server = new ArborescentMcpServer();
    try {
      await server.start(port, authToken);
      return { server, port: server.getPort() };
    } catch {
      logger.warn(
        `MCP port ${port} unavailable, ${attempt < maxRetries ? 'retrying' : 'giving up'}`,
        'McpServer'
      );
    }
  }

  return { server: null, port: 0 };
}
