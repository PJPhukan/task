export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

export interface User {
  id: string;
  name?: string;
  email: string;
  avatarPublicId?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  status: UserStatus;
}

export interface UserRole {
  id: string;
  displayName: string;
}

export interface MeResponse {
  user: User;
  roles?: UserRole[];
  permissions?: string[];
}

export type PermissionKey =
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'board.create'
  | 'board.update'
  | 'board.delete'
  | 'column.manage'
  | 'task.create'
  | 'task.update'
  | 'task.move'
  | 'task.delete'
  | 'task.delete.own'
  | 'comment.create'
  | 'comment.delete.any'
  | 'mention.all'
  | 'attachment.upload'
  | 'attachment.delete.any'
  | 'label.manage'
  | 'member.manage'
  | 'user.manage'
  | 'role.manage'
  | 'report.view.all';
