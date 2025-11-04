export interface ClaudeCodeSession {
  id: string;
  projectPath: string;
  lastModified: Date;
  firstMessage?: string;
}

export interface ClaudeCodeSessionListResult {
  sessions: ClaudeCodeSession[];
  error?: string;
}
