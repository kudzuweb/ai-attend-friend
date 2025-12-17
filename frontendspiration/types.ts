
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  subtasks?: Task[];
}

export interface Loop {
  id: string;
  content: string;
  createdAt: number;
}

export interface Reflection {
  id: string;
  content: string;
  createdAt: number;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
}

export interface SessionState {
  status: SessionStatus;
  startTime: number | null;
  durationMs: number;
  remainingMs: number;
  focusGoal: string;
}

export interface AIAnalysisResult {
  suggestion: string;
  revisedTasks?: Task[];
}
