import http from 'node:http';
import crypto from 'node:crypto';
import { logger } from './logger';

export type HookEventPayload = {
  session_id: string;
  hook_event_name: string;
  terminal_id?: string;
  message?: string;
};

type HookEventCallback = (payload: HookEventPayload) => void;

export class HookServer {
  private server: http.Server | null = null;
  private port = 0;

  async start(port: number, authToken: string, onEvent: HookEventCallback): Promise<void> {
    if (this.server) {
      await this.stop();
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res, authToken, onEvent);
    });

    return new Promise((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(port, '127.0.0.1', () => {
        const addr = this.server!.address() as { port: number };
        this.port = addr.port;
        logger.info(`Hook server listening on 127.0.0.1:${this.port}`, 'HookServer');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.port = 0;
        resolve();
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  getAddress(): string {
    if (!this.server) return '';
    const addr = this.server.address();
    if (typeof addr === 'string' || !addr) return '';
    return addr.address;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    authToken: string,
    onEvent: HookEventCallback
  ): void {
    if (req.url !== '/hook') {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }

    if (!this.validateAuth(req, authToken)) {
      logger.warn('Hook request rejected: invalid auth token', 'HookServer');
      res.writeHead(401);
      res.end();
      return;
    }

    this.readBody(req, (body) => {
      const payload = this.parseAndValidate(body);
      if (!payload) {
        logger.warn(`Hook request rejected: invalid payload body`, 'HookServer');
        res.writeHead(400);
        res.end();
        return;
      }

      logger.info(`Hook received: ${payload.hook_event_name} (session=${payload.session_id}${payload.terminal_id ? `, terminal=${payload.terminal_id}` : ''})`, 'HookServer');

      try {
        onEvent(payload);
      } catch (error) {
        logger.error('Hook event callback threw', error as Error, 'HookServer');
      }

      res.writeHead(200);
      res.end();
    }, () => {
      res.writeHead(400);
      res.end();
    });
  }

  private validateAuth(req: http.IncomingMessage, authToken: string): boolean {
    const header = req.headers.authorization;
    if (!header) return false;
    if (!header.startsWith('Bearer ')) return false;
    const token = header.slice(7);
    if (token.length === 0) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(authToken));
    } catch {
      return false;
    }
  }

  private readBody(
    req: http.IncomingMessage,
    onSuccess: (body: string) => void,
    onError: () => void
  ): void {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      if (!body) {
        onError();
        return;
      }
      onSuccess(body);
    });
    req.on('error', onError);
  }

  private parseAndValidate(body: string): HookEventPayload | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.session_id !== 'string') return null;
    if (typeof obj.hook_event_name !== 'string') return null;

    const payload: HookEventPayload = {
      session_id: obj.session_id,
      hook_event_name: obj.hook_event_name,
    };

    if (typeof obj.terminal_id === 'string') {
      payload.terminal_id = obj.terminal_id;
    }

    if (typeof obj.message === 'string') {
      payload.message = obj.message;
    }

    return payload;
  }
}

export async function startHookServerWithRetry(
  basePort: number,
  authToken: string,
  onEvent: HookEventCallback,
  maxRetries = 3
): Promise<{ server: HookServer | null; port: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const port = basePort + attempt;
    const server = new HookServer();
    try {
      await server.start(port, authToken, onEvent);
      return { server, port: server.getPort() };
    } catch {
      logger.warn(`Port ${port} unavailable, ${attempt < maxRetries ? 'retrying' : 'giving up'}`, 'HookServer');
    }
  }

  return { server: null, port: 0 };
}
