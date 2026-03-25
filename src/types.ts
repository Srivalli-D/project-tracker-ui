export type TaskStatus = "To Do" | "In Progress" | "In Review" | "Done";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type ViewMode = "kanban" | "list" | "timeline";

export interface Assignee {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string;
  startDate: string | null;
  dueDate: string;
  project: string;
  order: number;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  taskId: string;
  mode: "viewing" | "editing";
}

export interface Filters {
  statuses: TaskStatus[];
  priorities: Priority[];
  assigneeIds: string[];
  dueFrom: string;
  dueTo: string;
}

export interface SortState {
  key: "title" | "priority" | "dueDate";
  direction: "asc" | "desc";
}
