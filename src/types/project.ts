export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  taskCounter?: number;
  isPersonal?: boolean;
  ownerId?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: { userId: string }[];
  boardCount?: number;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  position: number;
  isOpen?: boolean;
  columns?: BoardColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  position: number;
  isDone: boolean;
  timeLimitHours?: number | null;
  canMove?: boolean;
  createdAt: string;
  updatedAt: string;
}
