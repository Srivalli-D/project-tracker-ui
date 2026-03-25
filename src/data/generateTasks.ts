import type { Assignee, Priority, Task, TaskStatus } from "../types";

export const STATUSES: TaskStatus[] = ["To Do", "In Progress", "In Review", "Done"];
export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];

export const ASSIGNEES: Assignee[] = [
  { id: "asha", name: "Asha Menon", color: "#0f766e" },
  { id: "rohan", name: "Rohan Iyer", color: "#b54708" },
  { id: "meera", name: "Meera Shah", color: "#7a5af8" },
  { id: "nikhil", name: "Nikhil Rao", color: "#155eef" },
  { id: "tara", name: "Tara Patel", color: "#c11574" },
  { id: "dev", name: "Dev Khanna", color: "#087443" },
];

const projects = [
  "Onboarding Revamp",
  "Billing Console",
  "Client Portal",
  "Ops Visibility",
  "Mobile Handoff",
  "Risk Audit",
  "Metrics Hub",
  "Partner Launch",
];

const verbs = ["Design", "Build", "Review", "Validate", "Refine", "Ship", "Audit", "Document"];
const nouns = [
  "workflow",
  "dashboard",
  "timeline",
  "handoff",
  "permissions",
  "analytics sync",
  "notification pass",
  "search polish",
];

export function generateTasks(total = 640): Task[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return Array.from({ length: total }, (_, index) => {
    const dueBase = new Date(monthStart);
    dueBase.setDate(((index * 3) % 34) - 4);

    const spreadMonth = index % 6;
    const dueDate = new Date(
      spreadMonth === 0 ? lastMonthStart : spreadMonth === 5 ? nextMonthStart : dueBase,
    );
    dueDate.setDate(dueBase.getDate());

    const includeStart = index % 5 !== 0;
    const startDate = includeStart ? new Date(dueDate) : null;
    if (startDate) {
      startDate.setDate(dueDate.getDate() - ((index % 7) + 1));
    }

    return {
      id: `task-${index + 1}`,
      title: `${verbs[index % verbs.length]} ${projects[index % projects.length]} ${nouns[index % nouns.length]}`,
      status: STATUSES[index % STATUSES.length],
      priority: PRIORITIES[index % PRIORITIES.length],
      assigneeId: ASSIGNEES[index % ASSIGNEES.length].id,
      startDate: startDate ? startDate.toISOString() : null,
      dueDate: dueDate.toISOString(),
      project: projects[index % projects.length],
      order: index,
    };
  });
}
