export interface ClaudeSession {
  id: string;
  projectPath: string;
  lastModified: Date;
  firstMessage?: string;
}

export interface ClaudeSessionListResult {
  sessions: ClaudeSession[];
  error?: string;
}
