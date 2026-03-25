import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from "react";
import { ASSIGNEES, generateTasks, STATUSES } from "../data/generateTasks";
import type { Filters, SortState, Task, ViewMode } from "../types";

interface TrackerState {
  tasks: Task[];
  filters: Filters;
  sort: SortState;
  view: ViewMode;
}

type TrackerAction =
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SET_SORT"; key: SortState["key"] }
  | { type: "TOGGLE_FILTER"; filter: "statuses" | "priorities" | "assigneeIds"; value: string }
  | { type: "SET_DATE_FILTER"; key: "dueFrom" | "dueTo"; value: string }
  | { type: "CLEAR_FILTERS" }
  | { type: "HYDRATE_FROM_URL"; filters: Filters; view: ViewMode }
  | {
      type: "UPDATE_TASK_STATUS";
      taskId: string;
      status: Task["status"];
      targetIndex?: number;
    };

const defaultFilters: Filters = {
  statuses: [],
  priorities: [],
  assigneeIds: [],
  dueFrom: "",
  dueTo: "",
};

const initialState: TrackerState = {
  tasks: generateTasks(),
  filters: defaultFilters,
  sort: { key: "dueDate", direction: "asc" },
  view: "kanban",
};

function reducer(state: TrackerState, action: TrackerAction): TrackerState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "SET_SORT":
      return {
        ...state,
        sort:
          state.sort.key === action.key
            ? { key: action.key, direction: state.sort.direction === "asc" ? "desc" : "asc" }
            : { key: action.key, direction: "asc" },
      };
    case "TOGGLE_FILTER": {
      const current = state.filters[action.filter] as string[];
      const next = current.includes(action.value)
        ? current.filter((item) => item !== action.value)
        : [...current, action.value];
      return { ...state, filters: { ...state.filters, [action.filter]: next } };
    }
    case "SET_DATE_FILTER":
      return { ...state, filters: { ...state.filters, [action.key]: action.value } };
    case "CLEAR_FILTERS":
      return { ...state, filters: defaultFilters };
    case "HYDRATE_FROM_URL":
      return { ...state, filters: action.filters, view: action.view };
    case "UPDATE_TASK_STATUS": {
      const movingTask = state.tasks.find((task) => task.id === action.taskId);
      if (!movingTask) return state;

      const grouped = new Map<Task["status"], Task[]>();
      for (const status of STATUSES) {
        grouped.set(status, []);
      }

      for (const task of state.tasks) {
        if (task.id === action.taskId) continue;
        const list = grouped.get(task.status);
        if (list) {
          list.push(task);
        } else {
          grouped.set(task.status, [task]);
        }
      }

      const destination = [...(grouped.get(action.status) ?? [])].sort((a, b) => a.order - b.order);
      const clampedIndex =
        action.targetIndex === undefined
          ? destination.length
          : Math.max(0, Math.min(action.targetIndex, destination.length));

      destination.splice(clampedIndex, 0, { ...movingTask, status: action.status });
      grouped.set(action.status, destination);

      const rebuilt: Task[] = [];
      let order = 0;
      for (const status of STATUSES) {
        const list = (grouped.get(status) ?? []).map((task) => ({ ...task, order: order++ }));
        rebuilt.push(...list);
      }

      return {
        ...state,
        tasks: rebuilt,
      };
    }
    default:
      return state;
  }
}

interface TrackerContextValue {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export function TrackerProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error("useTracker must be used inside TrackerProvider");
  }
  return context;
}

export { ASSIGNEES, defaultFilters };
