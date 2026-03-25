import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from "react";
import { ASSIGNEES } from "./data/generateTasks";
import { useTracker, defaultFilters } from "./store/TrackerContext";
import type { Filters, PresenceUser, Priority, SortState, Task, TaskStatus, ViewMode } from "./types";
import styles from "./App.module.css";

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "In Review", "Done"];
const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
const LIST_ROW_HEIGHT = 72;
const LIST_OVERSCAN = 5;

interface DragState {
  taskId: string;
  sourceStatus: TaskStatus;
  hoverStatus: TaskStatus | null;
  hoverIndex: number | null;
  originRect: DOMRect;
  pointerOffsetX: number;
  pointerOffsetY: number;
  x: number;
  y: number;
  mode: "dragging" | "snapback";
}

export default function App() {
  const { state, dispatch } = useTracker();
  const [presence, setPresence] = useState<PresenceUser[]>(() =>
    ASSIGNEES.slice(0, 4).map((assignee, index) => ({
      id: assignee.id,
      name: assignee.name,
      color: assignee.color,
      taskId: state.tasks[index].id,
      mode: index % 2 === 0 ? "editing" : "viewing",
    })),
  );
  const syncingFromPopState = useRef(false);

  useEffect(() => {
    const queryState = readQueryState();
    dispatch({ type: "HYDRATE_FROM_URL", filters: queryState.filters, view: queryState.view });
  }, [dispatch]);

  useEffect(() => {
    const onPopState = () => {
      syncingFromPopState.current = true;
      const queryState = readQueryState();
      dispatch({ type: "HYDRATE_FROM_URL", filters: queryState.filters, view: queryState.view });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dispatch]);

  useEffect(() => {
    const search = buildQueryString(state.filters, state.view);
    if (window.location.search === search) {
      syncingFromPopState.current = false;
      return;
    }

    if (syncingFromPopState.current) {
      syncingFromPopState.current = false;
      return;
    }

    window.history.pushState({}, "", `${window.location.pathname}${search}`);
  }, [state.filters, state.view]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresence((current) =>
        current.map((person, index) => ({
          ...person,
          taskId: state.tasks[(index * 29 + Math.floor(Math.random() * 37)) % state.tasks.length].id,
          mode: Math.random() > 0.45 ? "viewing" : "editing",
        })),
      );
    }, 3200);

    return () => window.clearInterval(timer);
  }, [state.tasks]);

  const filteredTasks = useMemo(() => filterTasks(state.tasks, state.filters), [state.tasks, state.filters]);
  const sortedTasks = useMemo(
    () => sortTasks(filteredTasks, state.sort),
    [filteredTasks, state.sort],
  );
  const counts = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        count: filteredTasks.filter((task) => task.status === status).length,
      })),
    [filteredTasks],
  );
  const hasActiveFilters = useMemo(() => hasFilters(state.filters), [state.filters]);

  const summary = [
    { label: "Visible tasks", value: filteredTasks.length },
    { label: "Overdue", value: filteredTasks.filter((task) => getOverdueDays(task) > 0).length },
    { label: "Due today", value: filteredTasks.filter(isDueToday).length },
    { label: "Critical", value: filteredTasks.filter((task) => task.priority === "Critical").length },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Velozity Global Solutions</p>
          <h1>Project tracker workspace</h1>
          <p className={styles.subtitle}>
            Three synchronized views over one shared task dataset, with URL-backed filters,
            custom drag interactions, and simulated collaboration.
          </p>
        </div>
        <ActiveUsersBar presence={presence} tasks={state.tasks} />
      </header>

      <section className={styles.summaryGrid}>
        {summary.map((item) => (
          <article key={item.label} className={styles.summaryCard}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <FilterBar
        filters={state.filters}
        hasActiveFilters={hasActiveFilters}
        onToggle={(filter, value) => dispatch({ type: "TOGGLE_FILTER", filter, value })}
        onDateChange={(key, value) => dispatch({ type: "SET_DATE_FILTER", key, value })}
        onClear={() => dispatch({ type: "CLEAR_FILTERS" })}
      />

      <section className={styles.toolbar}>
        <div className={styles.viewToggle}>
          {(["kanban", "list", "timeline"] as ViewMode[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`${styles.viewButton} ${state.view === view ? styles.viewButtonActive : ""}`}
              onClick={() => dispatch({ type: "SET_VIEW", view })}
            >
              {capitalize(view)}
            </button>
          ))}
        </div>
        <div className={styles.columnSummary}>
          {counts.map((item) => (
            <span key={item.status} className={styles.columnPill}>
              {item.status}: {item.count}
            </span>
          ))}
        </div>
      </section>

      <main className={styles.panel}>
        {state.view === "kanban" ? (
          <KanbanView tasks={filteredTasks} presence={presence} onStatusChange={(taskId, status, targetIndex) => dispatch({ type: "UPDATE_TASK_STATUS", taskId, status, targetIndex })} />
        ) : null}
        {state.view === "list" ? (
          <ListView
            tasks={sortedTasks}
            presence={presence}
            sort={state.sort}
            hasActiveFilters={hasActiveFilters}
            onSort={(key) => dispatch({ type: "SET_SORT", key })}
            onStatusChange={(taskId, status, targetIndex) => dispatch({ type: "UPDATE_TASK_STATUS", taskId, status, targetIndex })}
            onClearFilters={() => dispatch({ type: "CLEAR_FILTERS" })}
          />
        ) : null}
        {state.view === "timeline" ? <TimelineView tasks={sortedTasks} /> : null}
      </main>
    </div>
  );
}

function FilterBar({
  filters,
  hasActiveFilters,
  onToggle,
  onDateChange,
  onClear,
}: {
  filters: Filters;
  hasActiveFilters: boolean;
  onToggle: (filter: "statuses" | "priorities" | "assigneeIds", value: string) => void;
  onDateChange: (key: "dueFrom" | "dueTo", value: string) => void;
  onClear: () => void;
}) {
  return (
    <section className={styles.filterBar}>
      <FilterGroup
        label="Status"
        items={STATUSES.map((status) => ({ value: status, label: status, active: filters.statuses.includes(status) }))}
        onToggle={(value) => onToggle("statuses", value)}
      />
      <FilterGroup
        label="Priority"
        items={PRIORITIES.map((priority) => ({
          value: priority,
          label: priority,
          active: filters.priorities.includes(priority),
        }))}
        onToggle={(value) => onToggle("priorities", value)}
      />
      <FilterGroup
        label="Assignee"
        items={ASSIGNEES.map((person) => ({
          value: person.id,
          label: person.name,
          active: filters.assigneeIds.includes(person.id),
        }))}
        onToggle={(value) => onToggle("assigneeIds", value)}
      />
      <div className={styles.dateGroup}>
        <label>
          <span>Due from</span>
          <input type="date" value={filters.dueFrom} onChange={(event) => onDateChange("dueFrom", event.target.value)} />
        </label>
        <label>
          <span>Due to</span>
          <input type="date" value={filters.dueTo} onChange={(event) => onDateChange("dueTo", event.target.value)} />
        </label>
      </div>
      {hasActiveFilters ? (
        <button type="button" className={styles.clearButton} onClick={onClear}>
          Clear all filters
        </button>
      ) : null}
    </section>
  );
}

function FilterGroup({
  label,
  items,
  onToggle,
}: {
  label: string;
  items: Array<{ value: string; label: string; active: boolean }>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className={styles.filterGroup}>
      <span>{label}</span>
      <div className={styles.chips}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${styles.chip} ${item.active ? styles.chipActive : ""}`}
            onClick={() => onToggle(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActiveUsersBar({ presence, tasks }: { presence: PresenceUser[]; tasks: Task[] }) {
  return (
    <aside className={styles.presencePanel}>
      <div className={styles.presenceHeader}>
        <strong>{presence.length} people are viewing this board</strong>
        <span>Presence updates every few seconds</span>
      </div>
      <div className={styles.presenceList}>
        {presence.map((person) => {
          const task = tasks.find((item) => item.id === person.taskId);
          return (
            <div key={person.id} className={styles.presencePerson}>
              <Avatar label={person.name} color={person.color} />
              <div>
                <strong>{person.name}</strong>
                <span>
                  {person.mode} {task?.title ?? "task"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function KanbanView({
  tasks,
  presence,
  onStatusChange,
}: {
  tasks: Task[];
  presence: PresenceUser[];
  onStatusChange: (taskId: string, status: TaskStatus, targetIndex?: number) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const columnsRef = useRef<Record<TaskStatus, HTMLDivElement | null>>({
    "To Do": null,
    "In Progress": null,
    "In Review": null,
    Done: null,
  });

  const handlePointerMove = (event: PointerEvent) => {
    setDrag((current) => {
      if (!current) return current;
      const hovered = Object.entries(columnsRef.current).find(([, element]) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      return {
        ...current,
        x: event.clientX,
        y: event.clientY,
        hoverStatus: (hovered?.[0] as TaskStatus | undefined) ?? null,
        hoverIndex: (() => {
          if (!hovered?.[1]) return null;
          const cards = Array.from(hovered[1].querySelectorAll(`.${styles.card}`)) as HTMLElement[];
          let index = cards.length;
          for (let i = 0; i < cards.length; i += 1) {
            const rect = cards[i].getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
              index = i;
              break;
            }
          }
          return index;
        })(),
      };
    });
  };

  const clearListeners = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handlePointerUp = () => {
    setDrag((current) => {
      if (!current) return current;
      clearListeners();
      if (current.hoverStatus) {
        onStatusChange(current.taskId, current.hoverStatus, current.hoverIndex ?? undefined);
        return null;
      }

      window.setTimeout(() => setDrag(null), 180);
      return {
        ...current,
        x: current.originRect.left + current.pointerOffsetX,
        y: current.originRect.top + current.pointerOffsetY,
        mode: "snapback",
      };
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, task: Task) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDrag({
      taskId: task.id,
      sourceStatus: task.status,
      hoverStatus: task.status,
      hoverIndex: null,
      originRect: rect,
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
      x: event.clientX,
      y: event.clientY,
      mode: "dragging",
    });
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  useEffect(() => () => clearListeners(), []);

  return (
    <div className={styles.kanbanBoard}>
      {STATUSES.map((status) => {
        const columnTasks = tasks
          .filter((task) => task.status === status)
          .sort((left, right) => left.order - right.order);
        return (
          <section
            key={status}
            className={`${styles.column} ${drag?.hoverStatus === status ? styles.columnHover : ""}`}
          >
            <header className={styles.columnHeader}>
              <h2>{status}</h2>
              <span>{columnTasks.length}</span>
            </header>
            <div
              ref={(element) => {
                columnsRef.current[status] = element;
              }}
              className={styles.columnBody}
            >
              {columnTasks.length === 0 ? (
                <EmptyState title="No tasks here yet" description="Drag a task into this column or relax the active filters." />
              ) : (
                columnTasks.map((task) =>
                  drag?.taskId === task.id && drag.sourceStatus === status ? (
                    <div key={task.id} className={styles.placeholder} />
                  ) : (
                    <article
                      key={task.id}
                      className={styles.card}
                      onPointerDown={(event) => startDrag(event, task)}
                    >
                      <div className={styles.cardHeader}>
                        <strong>{task.title}</strong>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <div className={styles.cardMeta}>
                        <Avatar label={getAssignee(task.assigneeId).name} color={getAssignee(task.assigneeId).color} compact />
                        <span>{getAssignee(task.assigneeId).name}</span>
                      </div>
                      <div className={styles.cardFooter}>
                        <span className={getOverdueDays(task) > 0 ? styles.dueDanger : styles.dueText}>{formatDueLabel(task)}</span>
                        <PresenceStack users={presence.filter((person) => person.taskId === task.id)} />
                      </div>
                    </article>
                  ),
                )
              )}
            </div>
          </section>
        );
      })}
      {drag ? (
        <div
          className={`${styles.dragOverlay} ${drag.mode === "snapback" ? styles.dragOverlaySnap : ""}`}
          style={{
            width: drag.originRect.width,
            height: drag.originRect.height,
            left: drag.x - drag.pointerOffsetX,
            top: drag.y - drag.pointerOffsetY,
          }}
        >
          {(() => {
            const task = tasks.find((item) => item.id === drag.taskId);
            if (!task) return null;
            return (
              <article className={`${styles.card} ${styles.dragCard}`}>
                <div className={styles.cardHeader}>
                  <strong>{task.title}</strong>
                  <PriorityBadge priority={task.priority} />
                </div>
                <div className={styles.cardMeta}>
                  <Avatar label={getAssignee(task.assigneeId).name} color={getAssignee(task.assigneeId).color} compact />
                  <span>{getAssignee(task.assigneeId).name}</span>
                </div>
                <div className={styles.cardFooter}>
                  <span className={getOverdueDays(task) > 0 ? styles.dueDanger : styles.dueText}>{formatDueLabel(task)}</span>
                  <PresenceStack users={presence.filter((person) => person.taskId === task.id)} />
                </div>
              </article>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

function ListView({
  tasks,
  presence,
  sort,
  hasActiveFilters,
  onSort,
  onStatusChange,
  onClearFilters,
}: {
  tasks: Task[];
  presence: PresenceUser[];
  sort: SortState;
  hasActiveFilters: boolean;
  onSort: (key: SortState["key"]) => void;
  onStatusChange: (taskId: string, status: TaskStatus, targetIndex?: number) => void;
  onClearFilters: () => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeight = 620;
  const totalHeight = tasks.length * LIST_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / LIST_ROW_HEIGHT) - LIST_OVERSCAN);
  const visibleCount = Math.ceil(containerHeight / LIST_ROW_HEIGHT) + LIST_OVERSCAN * 2;
  const endIndex = Math.min(tasks.length, startIndex + visibleCount);
  const visibleTasks = tasks.slice(startIndex, endIndex);
  const topSpacer = startIndex * LIST_ROW_HEIGHT;
  const bottomSpacer = Math.max(0, totalHeight - endIndex * LIST_ROW_HEIGHT);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks match these filters"
        description="Try widening the date range or clear the active chips to restore the full dataset."
        action={hasActiveFilters ? { label: "Clear filters", onClick: onClearFilters } : undefined}
      />
    );
  }

  return (
    <div className={styles.listWrap}>
      <div className={styles.listHeader}>
        <SortButton label="Task" active={sort.key === "title"} direction={sort.direction} onClick={() => onSort("title")} />
        <SortButton label="Priority" active={sort.key === "priority"} direction={sort.direction} onClick={() => onSort("priority")} />
        <SortButton label="Due date" active={sort.key === "dueDate"} direction={sort.direction} onClick={() => onSort("dueDate")} />
        <span>Assignee</span>
        <span>Status</span>
      </div>
      <div className={styles.listBody} onScroll={handleScroll}>
        <div style={{ paddingTop: topSpacer, paddingBottom: bottomSpacer }}>
          {visibleTasks.map((task) => {
            const users = presence.filter((person) => person.taskId === task.id);
            return (
              <div key={task.id} className={styles.listRow}>
                <div className={styles.taskCell}>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.project}</small>
                  </div>
                </div>
                <div><PriorityBadge priority={task.priority} /></div>
                <div className={getOverdueDays(task) > 0 ? styles.dueDanger : styles.dueText}>{formatDueLabel(task)}</div>
                <div className={styles.assigneeCell}>
                  <Avatar label={getAssignee(task.assigneeId).name} color={getAssignee(task.assigneeId).color} compact />
                  <span>{getAssignee(task.assigneeId).name}</span>
                  <PresenceStack users={users} />
                </div>
                <div>
                  <select
                    className={styles.select}
                    value={task.status}
                    onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineView({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const totalDays = monthEnd.getDate();
  const dayWidth = 52;
  const leftColumnWidth = 240;

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.timelineMeta}>
        <div>
          <span>Current month timeline</span>
          <strong>{monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
        </div>
        <p>Tasks without a start date are rendered as due-date milestones.</p>
      </div>
      <div className={styles.timelineScroller}>
        <div className={styles.timelineGrid} style={{ ["--days" as string]: totalDays, ["--day-width" as string]: `${dayWidth}px` }}>
          <div className={styles.timelineHeader}>
            <div className={styles.timelineSticky}>Task</div>
            {Array.from({ length: totalDays }, (_, index) => (
              <div key={index} className={styles.dayCell}>
                {index + 1}
              </div>
            ))}
          </div>
          {tasks.map((task) => {
            const dueDate = new Date(task.dueDate);
            const startDate = task.startDate ? new Date(task.startDate) : null;
            const startDay = clampDay(startDate ?? dueDate, monthStart, monthEnd);
            const endDay = clampDay(dueDate, monthStart, monthEnd);
            const left = leftColumnWidth + (startDay - 1) * dayWidth + 8;
            const width = Math.max(dayWidth - 16, (endDay - startDay + 1) * dayWidth - 16);
            return (
              <div key={task.id} className={styles.timelineRow}>
                <div className={styles.timelineSticky}>
                  <strong>{task.title}</strong>
                  <span>{getAssignee(task.assigneeId).name}</span>
                </div>
                <div className={styles.timelineCells}>
                  {Array.from({ length: totalDays }, (_, index) => (
                    <span key={index} />
                  ))}
                  <div
                    className={`${styles.timelineBar} ${!task.startDate ? styles.timelineMilestone : ""}`}
                    style={{
                      left,
                      width,
                      background: priorityColor(task.priority),
                    }}
                  >
                    {task.startDate ? task.priority : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div
            className={styles.todayLine}
            style={{ left: leftColumnWidth + (Math.min(totalDays, Math.max(1, now.getDate())) - 1) * dayWidth + dayWidth / 2 }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={styles.emptyState}>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? (
        <button type="button" className={styles.clearButton} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" className={`${styles.sortButton} ${active ? styles.sortButtonActive : ""}`} onClick={onClick}>
      {label} {active ? (direction === "asc" ? "(ASC)" : "(DESC)") : ""}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={styles.priorityBadge} style={{ background: priorityColor(priority) }}>{priority}</span>;
}

function PresenceStack({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) {
    return <span className={styles.presenceHint}>No viewers</span>;
  }

  const visible = users.slice(0, 2);
  const overflow = users.length - visible.length;

  return (
    <div className={styles.presenceStack}>
      {visible.map((user) => (
        <span
          key={user.id}
          className={styles.presenceAvatar}
          style={{ background: user.color }}
          title={`${user.name} is ${user.mode}`}
        >
          {getInitials(user.name)}
        </span>
      ))}
      {overflow > 0 ? <span className={styles.presenceOverflow}>+{overflow}</span> : null}
    </div>
  );
}

function Avatar({ label, color, compact = false }: { label: string; color: string; compact?: boolean }) {
  return (
    <span className={`${styles.avatar} ${compact ? styles.avatarCompact : ""}`} style={{ background: color }}>
      {getInitials(label)}
    </span>
  );
}

function readQueryState(): { filters: Filters; view: ViewMode } {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const filters: Filters = {
    statuses: readListParam<TaskStatus>(params, "status"),
    priorities: readListParam<Priority>(params, "priority"),
    assigneeIds: readListParam<string>(params, "assignee"),
    dueFrom: params.get("dueFrom") ?? "",
    dueTo: params.get("dueTo") ?? "",
  };
  const view: ViewMode = viewParam === "list" || viewParam === "timeline" ? viewParam : "kanban";
  return { filters, view };
}

function buildQueryString(filters: Filters, view: ViewMode) {
  const params = new URLSearchParams();
  if (view !== "kanban") params.set("view", view);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.priorities.length) params.set("priority", filters.priorities.join(","));
  if (filters.assigneeIds.length) params.set("assignee", filters.assigneeIds.join(","));
  if (filters.dueFrom) params.set("dueFrom", filters.dueFrom);
  if (filters.dueTo) params.set("dueTo", filters.dueTo);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function readListParam<T extends string>(params: URLSearchParams, key: string): T[] {
  const value = params.get(key);
  return value ? (value.split(",") as T[]) : [];
}

function filterTasks(tasks: Task[], filters: Filters) {
  return tasks.filter((task) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
    if (filters.assigneeIds.length > 0 && !filters.assigneeIds.includes(task.assigneeId)) return false;

    const due = formatDateInput(task.dueDate);
    if (filters.dueFrom && due < filters.dueFrom) return false;
    if (filters.dueTo && due > filters.dueTo) return false;

    return true;
  });
}

function sortTasks(tasks: Task[], sort: SortState) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...tasks].sort((left, right) => {
    if (sort.key === "title") {
      return direction * left.title.localeCompare(right.title);
    }
    if (sort.key === "priority") {
      return direction * (PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]);
    }
    return direction * (new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
  });
}

function hasFilters(filters: Filters) {
  return JSON.stringify(filters) !== JSON.stringify(defaultFilters);
}

function getAssignee(assigneeId: string) {
  return ASSIGNEES.find((assignee) => assignee.id === assigneeId) ?? ASSIGNEES[0];
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isDueToday(task: Task) {
  return formatDateInput(task.dueDate) === formatDateInput(new Date().toISOString());
}

function getOverdueDays(task: Task) {
  const due = startOfDay(new Date(task.dueDate)).getTime();
  const now = startOfDay(new Date()).getTime();
  if (task.status === "Done" || due >= now) return 0;
  return Math.floor((now - due) / 86400000);
}

function formatDueLabel(task: Task) {
  if (isDueToday(task)) return "Due Today";
  const overdueDays = getOverdueDays(task);
  if (overdueDays > 7) return `${overdueDays} days overdue`;
  return new Date(task.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function priorityColor(priority: Priority) {
  return { Critical: "#b42318", High: "#dc6803", Medium: "#0f766e", Low: "#155eef" }[priority];
}

function clampDay(date: Date, monthStart: Date, monthEnd: Date) {
  if (date < monthStart) return 1;
  if (date > monthEnd) return monthEnd.getDate();
  return date.getDate();
}





