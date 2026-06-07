import type { TerminalBufferedOutput } from '../../shared/types/electronApi';

const DEFAULT_RETENTION_BOUND = 8192;

// Per-terminal record of PTY output: a bounded list of the chunks most recently
// emitted, plus a monotonic total length used as an offset watermark.
//
// A renderer that attaches its data listener after the shell already drew its
// prompt replays this buffer to recover the missed bytes, then dedupes the live
// stream against the end offset. Trimming drops whole oldest chunks rather than
// slicing to a byte tail, so the retained range always begins on a chunk
// boundary and replay never starts mid-escape-sequence — which would corrupt the
// xterm parser.
export class TerminalOutputBuffer {
  private readonly chunks = new Map<string, string[]>();
  private readonly totalLength = new Map<string, number>();
  private readonly retainedLength = new Map<string, number>();

  constructor(private readonly retentionBound: number = DEFAULT_RETENTION_BOUND) {}

  append(id: string, data: string): number {
    const chunks = this.chunks.get(id) ?? [];
    chunks.push(data);
    const total = (this.totalLength.get(id) ?? 0) + data.length;
    let retained = (this.retainedLength.get(id) ?? 0) + data.length;

    while (chunks.length > 1 && retained > this.retentionBound) {
      retained -= chunks.shift()!.length;
    }

    this.chunks.set(id, chunks);
    this.totalLength.set(id, total);
    this.retainedLength.set(id, retained);
    return total;
  }

  read(id: string): TerminalBufferedOutput {
    const chunks = this.chunks.get(id);
    return {
      data: chunks ? chunks.join('') : '',
      endOffset: this.totalLength.get(id) ?? 0,
    };
  }

  recentTail(id: string, maxLength: number = DEFAULT_RETENTION_BOUND): string {
    const chunks = this.chunks.get(id);
    if (!chunks) return '';
    const data = chunks.join('');
    return data.length > maxLength ? data.slice(-maxLength) : data;
  }

  clear(id: string): void {
    this.chunks.delete(id);
    this.totalLength.delete(id);
    this.retainedLength.delete(id);
  }
}

export const terminalOutputBuffer = new TerminalOutputBuffer();
