export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ColumnColor =
  | 'column-1'
  | 'column-2'
  | 'column-3'
  | 'column-4'
  | 'column-5'
  | 'column-6'
  | 'column-7'
  | 'column-8';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
