export interface TaskLabel {
  id: string;
  name: string;
  color?: string | null;
}

export interface TaskUser {
  id: string;
  name: string;
  email: string;
}

export interface TaskStageEntry {
  id?: string;
  taskId?: string;
  columnId?: string;
  enteredAt: string;
  leftAt?: string | null;
  durationSeconds?: number | null;
  isSendBack?: boolean;
  sendBackReason?: string | null;
}

export interface BoardTask {
  id: string;
  projectId: string;
  boardId: string;
  columnId: string;
  number: number;
  key: string;
  title: string;
  description?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startDate?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: TaskUser | null;
  reporterId?: string | null;
  reporter?: TaskUser | null;
  position: number;
  completedAt?: string | null;
  bounceCount: number;
  waitingSeconds: number;
  overLimit: boolean;
  labels?: TaskLabel[];
  stageHistory?: TaskStageEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ColumnRole {
  id: string;
  displayName: string;
}

export interface BoardColumnWithTasks {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  position: number;
  isDone: boolean;
  timeLimitHours?: number | null;
  canMove?: boolean;
  tasks: BoardTask[];
  moveRoles?: ColumnRole[];
  viewRoles?: ColumnRole[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardDetails {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  position: number;
  isOpen?: boolean;
  columns: BoardColumnWithTasks[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardFiltersState {
  search: string;
  assigneeId: string; // '' | 'unassigned' | userId
  priority: string;   // '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  labelId: string;    // '' | labelId
  overdue: boolean;
}
