import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
// eslint-disable-next-line import/no-unresolved
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// eslint-disable-next-line import/no-unresolved
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
// eslint-disable-next-line import/no-unresolved
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger } from './logger';
import { SessionBindingRegistry } from './sessionBindingRegistry';
import { createReadTools, ReadTools, TreeReader } from './mcpReadTools';
import { createWriteTools, WriteTools, TreeMutator } from './mcpWriteTools';
import { ProposalSubmitter } from './mcpProposalBridge';
import {
  createSubmitOutputTool,
  SubmitOutputTool,
  StepOutputApplier,
} from './mcpSubmitOutputTool';
import { OneShotTargetStore } from './oneShotTargetStore';

const MCP_PATH = '/mcp';
const SERVER_NAME = 'arborescent';
const SERVER_VERSION = '0.2.0';

type McpSession = { transport: StreamableHTTPServerTransport; mcp: McpServer };

export class ArborescentMcpServer {
  private httpServer: http.Server | null = null;
  private port = 0;
  private authToken = '';
  private bindingRegistry = new SessionBindingRegistry();
  private oneShotTargetStore = new OneShotTargetStore();
  private readTools: ReadTools | null = null;
  private writeTools: WriteTools | null = null;
  private submitOutputTool: SubmitOutputTool | null = null;
  private sessions: Map<string, McpSession> = new Map();

  constructor() {}

  attachReadTools(treeReader: TreeReader): void {
    if (this.readTools) {
      logger.warn('attachReadTools called twice — ignoring; existing read tools remain in effect', 'McpServer');
      return;
    }
    this.readTools = createReadTools({
      bindingRegistry: this.bindingRegistry,
      treeReader,
    });
  }

  private registerReadTools(mcp: McpServer, tools: ReadTools): void {
    const sessionIdSchema = { session_id: z.string().min(1).describe('Claude Code session ID') };

    mcp.registerTool(
      'get_node',
      {
        title: 'Get bound node',
        description:
          'Returns the content, metadata, and current effective mode for the node bound to this session.',
        inputSchema: sessionIdSchema,
      },
      async (args) => tools.getNode({ sessionId: args.session_id }),
    );

    mcp.registerTool(
      'get_tree',
      {
        title: 'Get subtree from bound node',
        description:
          'Returns the subtree rooted at the bound node, optionally limited to a depth. Use depth=0 to get just the bound node.',
        inputSchema: {
          ...sessionIdSchema,
          depth: z.number().int().min(0).optional().describe('Maximum tree depth (0 = root only)'),
        },
      },
      async (args) =>
        tools.getTree({ sessionId: args.session_id, depth: args.depth as number | undefined }),
    );

    mcp.registerTool(
      'list_contexts',
      {
        title: 'List contexts in scope',
        description:
          'Returns the contexts declared in the bound tree. The currently-applied context is listed first with applied=true.',
        inputSchema: sessionIdSchema,
      },
      async (args) => tools.listContexts({ sessionId: args.session_id }),
    );
  }

  attachWriteTools(treeReader: TreeReader, treeMutator: TreeMutator, proposalSubmitter: ProposalSubmitter): void {
    if (this.writeTools) {
      logger.warn('attachWriteTools called twice — ignoring; existing write tools remain in effect', 'McpServer');
      return;
    }
    this.writeTools = createWriteTools({
      bindingRegistry: this.bindingRegistry,
      treeReader,
      treeMutator,
      proposalSubmitter,
      oneShotTargetStore: this.oneShotTargetStore,
    });
  }

  private registerWriteTools(mcp: McpServer, tools: WriteTools): void {
    const sessionIdSchema = { session_id: z.string().min(1).describe('Claude Code session ID') };

    mcp.registerTool(
      'add_child_node',
      {
        title: 'Add a child node',
        description: 'Adds a new child node under the given parent. Only allowed on automatic steps in collaborate or collaborate+execute mode.',
        inputSchema: {
          ...sessionIdSchema,
          parent_id: z.string().min(1).describe('UUID of the parent node'),
          content: z.string().describe('Content of the new child node'),
          position: z.number().int().min(0).optional().describe('Position among parent children (0-indexed; defaults to end)'),
        },
      },
      async (args) =>
        tools.addChildNode({
          sessionId: args.session_id,
          parent_id: args.parent_id,
          content: args.content,
          position: args.position as number | undefined,
        }),
    );

    mcp.registerTool(
      'append_to_node',
      {
        title: 'Append to bound node content',
        description: 'Appends the given content to the bound node. Only allowed on automatic steps in collaborate or collaborate+execute mode.',
        inputSchema: {
          ...sessionIdSchema,
          content: z.string().describe('Text to append to the bound node'),
        },
      },
      async (args) => tools.appendToNode({ sessionId: args.session_id, content: args.content }),
    );

    mcp.registerTool(
      'mark_step_complete',
      {
        title: 'Mark bound step status',
        description: 'Marks the bound step as completed or abandoned. Only allowed on automatic steps in collaborate or collaborate+execute mode.',
        inputSchema: {
          ...sessionIdSchema,
          status: z.enum(['completed', 'abandoned']).describe('New status for the bound step'),
        },
      },
      async (args) => tools.markStepComplete({ sessionId: args.session_id, status: args.status }),
    );

    mcp.registerTool(
      'announce_step_done',
      {
        title: 'Announce action step complete',
        description:
          'Signals that an autonomous workflow step has finished. Use this when the applied context is execute-only or pure action-mode (no content to submit). Rejected when the applied context has collaborate=true — those steps require submit_step_output with the reviewed content.',
        inputSchema: sessionIdSchema,
      },
      async (args) => tools.announceStepDone({ sessionId: args.session_id }),
    );

    mcp.registerTool(
      'set_node_content',
      {
        title: 'Replace bound node content',
        description: 'Replaces the bound node content. Only allowed in collaborate-only mode on automatic steps.',
        inputSchema: {
          ...sessionIdSchema,
          content: z.string().describe('New content for the bound node'),
        },
      },
      async (args) => tools.setNodeContent({ sessionId: args.session_id, content: args.content }),
    );

    mcp.registerTool(
      'delete_node',
      {
        title: 'Delete the bound node',
        description: 'Deletes the bound node and its descendants. Only allowed in collaborate-only mode on automatic steps.',
        inputSchema: sessionIdSchema,
      },
      async (args) => tools.deleteNode({ sessionId: args.session_id }),
    );

    mcp.registerTool(
      'move_node',
      {
        title: 'Move the bound node',
        description: 'Moves the bound node under a new parent. Only allowed in collaborate-only mode on automatic steps.',
        inputSchema: {
          ...sessionIdSchema,
          new_parent_id: z.string().min(1).describe('UUID of the new parent node'),
          position: z.number().int().min(0).optional().describe('Position among new parent children (0-indexed)'),
        },
      },
      async (args) =>
        tools.moveNode({
          sessionId: args.session_id,
          new_parent_id: args.new_parent_id,
          position: args.position as number | undefined,
        }),
    );

    mcp.registerTool(
      'set_node_metadata',
      {
        title: 'Set a metadata key on the bound node',
        description: 'Sets a metadata key/value on the bound node. Only allowed in collaborate-only mode on automatic steps.',
        inputSchema: {
          ...sessionIdSchema,
          key: z.string().min(1).describe('Metadata key'),
          value: z.unknown().describe('Metadata value'),
        },
      },
      async (args) => tools.setNodeMetadata({ sessionId: args.session_id, key: args.key, value: args.value }),
    );
  }

  attachSubmitOutputTool(treeReader: TreeReader, applier: StepOutputApplier, proposalSubmitter: ProposalSubmitter): void {
    if (this.submitOutputTool) {
      logger.warn(
        'attachSubmitOutputTool called twice — ignoring; existing tool remains in effect',
        'McpServer',
      );
      return;
    }
    this.submitOutputTool = createSubmitOutputTool({
      bindingRegistry: this.bindingRegistry,
      treeReader,
      applier,
      oneShotTargetStore: this.oneShotTargetStore,
      proposalSubmitter,
    });
  }

  private registerSubmitOutputTool(mcp: McpServer, tool: SubmitOutputTool): void {
    mcp.registerTool(
      'submit_step_output',
      {
        title: 'Submit step output',
        description:
          'Submits the assistant response back to the bound Arborescent node. The binding comes from any Arborescent send (a one-off send-to-terminal, or a workflow step). If the bound node sits under an autonomous workflow step, the content is applied directly to the node. Otherwise — manual sends, and manual/checkpoint workflow steps — the content appears in the feedback panel for the user to review and accept or reject; call again with revised content to refresh the panel. Applied regardless of context mode flags.',
        inputSchema: {
          session_id: z.string().min(1).describe('Claude Code session ID'),
          content: z.string().describe('Assistant response content to apply to the bound node'),
          // Schema is .optional() so manual-collab and free-terminal submissions
          // still validate. The autonomous-route gate-4 check in
          // mcpSubmitOutputTool enforces presence + equality at runtime —
          // don't tighten the schema to .required() without re-routing manual.
          target_node_id: z
            .string()
            .optional()
            .describe('Echo of the bound node UUID that the prompt was rendered for. Required on autonomous-route submissions; the server rejects the call if it does not match the resolved bound node at submit time (guards against in-flight rebind drift). Omit for manual-collab and free-terminal submissions.'),
          origin: z
            .enum(['explicit', 'safety-net'])
            .optional()
            .describe('Internal: omit. Set to "safety-net" by the Stop hook auto-submit script.'),
        },
      },
      async (args) =>
        tool.submitStepOutput({
          sessionId: args.session_id,
          content: args.content,
          targetNodeId: args.target_node_id,
          origin: args.origin as 'explicit' | 'safety-net' | undefined,
        }),
    );
  }

  async start(port: number, authToken: string): Promise<void> {
    if (this.httpServer) {
      throw new Error('MCP server already started');
    }
    if (!authToken) {
      throw new Error('MCP server requires an auth token');
    }
    this.authToken = authToken;

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
    for (const { transport, mcp } of this.sessions.values()) {
      await transport.close();
      await mcp.close();
    }
    this.sessions.clear();
    this.oneShotTargetStore.clear();
    logger.info('MCP server stopped', 'McpServer');
  }

  getPort(): number {
    return this.port;
  }

  getBindingRegistry(): SessionBindingRegistry {
    return this.bindingRegistry;
  }

  getOneShotTargetStore(): OneShotTargetStore {
    return this.oneShotTargetStore;
  }

  private registerSmokeTool(mcp: McpServer): void {
    mcp.registerTool(
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

  private buildConfiguredMcpServer(): McpServer {
    const mcp = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    this.registerSmokeTool(mcp);
    if (this.readTools) this.registerReadTools(mcp, this.readTools);
    if (this.writeTools) this.registerWriteTools(mcp, this.writeTools);
    if (this.submitOutputTool) this.registerSubmitOutputTool(mcp, this.submitOutputTool);
    return mcp;
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
    const headerSessionId = req.headers['mcp-session-id'];
    const sessionId = typeof headerSessionId === 'string' ? headerSessionId : undefined;

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

      let session: McpSession | undefined;
      if (sessionId) session = this.sessions.get(sessionId);

      if (!session && isInitializeRequest(parsedBody)) {
        session = await this.openSession();
      }

      if (!session) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID for non-initialize request' },
            id: null,
          }),
        );
        return;
      }

      await session.transport.handleRequest(req, res, parsedBody);
      return;
    }

    const existing = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!existing) {
      res.writeHead(400);
      res.end();
      return;
    }
    await existing.transport.handleRequest(req, res);
  }

  private async openSession(): Promise<McpSession> {
    const mcp = this.buildConfiguredMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sessions.set(id, { transport, mcp });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) this.sessions.delete(transport.sessionId);
    };
    await mcp.connect(transport);
    return { transport, mcp };
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
