# Project Tracker UI

## Live Demo

[Open the deployed app](https://project-tracker-bfc9qozfd-dasari-srivallis-projects.vercel.app)

Multi-view React + TypeScript frontend for the Velozity Global Solutions technical assessment. The app renders one shared task dataset in Kanban, list, and timeline views, supports custom drag-and-drop, uses hand-built virtual scrolling in the list, simulates live collaboration, and keeps filter state in the URL.

## Setup

1. Install dependencies with `npm install`
2. Start the dev server with `npm run dev`
3. Build for production with `npm run build`

## Stack

- React 18
- TypeScript
- Vite
- CSS Modules
- React Context + `useReducer`

## State Management Choice

I used React Context with `useReducer` instead of Zustand because the state shape is tightly scoped to one application surface and the update paths are explicit: view switching, filter changes, sorting, and task status updates. The reducer keeps those transitions predictable and easy to test, while Context makes the shared task data available to all three views without prop drilling. Since the app does not need asynchronous server caching or deeply nested store slices, this approach keeps the dependency footprint minimal and matches the assessment constraint of building core behavior by hand.

## Virtual Scrolling Approach

The list view uses fixed-height rows and manual windowing. On scroll, the component calculates:

- the first visible row index
- a buffer of 5 rows above and below the viewport
- spacer padding above and below the rendered subset

That means the DOM only contains the visible rows plus the overscan buffer, while the scrollbar still reflects the full dataset height. This keeps scrolling smooth even with the 640-task seed dataset and avoids react-window or any other virtualization package.

## Drag-and-Drop Approach

Kanban drag-and-drop is implemented with native pointer events. On pointer down, the app records the card bounds and pointer offset, renders a floating drag overlay, and leaves a placeholder in the original slot so the column layout does not shift. While dragging, the overlay follows the pointer and columns are checked with bounding boxes to determine the active drop target. Dropping on a valid column dispatches a status update into the shared reducer. Dropping outside any valid column triggers a snap-back animation by transitioning the overlay back to its original coordinates before clearing drag state. Because this uses pointer events, the same interaction path works for mouse and touch input.

## URL State

Filters are serialized into query parameters:

- `status`
- `priority`
- `assignee`
- `dueFrom`
- `dueTo`
- `view`

Every filter change pushes a new URL, and `popstate` rehydrates the reducer so browser back/forward restores the exact filter state.

## Seed Data

Task generation lives in `src/data/generateTasks.ts` and creates 640 tasks across multiple statuses, priorities, assignees, overdue dates, and missing start dates.

## Explanation Field

The hardest UI problem here was making drag-and-drop feel stable while the board still behaved like a normal layout. The key issue was preserving the original card position without causing the entire column to collapse or reflow while the user dragged. I solved that by splitting the interaction into two layers: the source column keeps a placeholder block with the same approximate dimensions as the dragged card, and a separate fixed-position overlay follows the pointer. That let the column keep its spatial rhythm while the user got direct visual feedback from the floating card. For invalid drops, I reused the original card rectangle captured at drag start and animated the overlay back to that exact location, which gave the snap-back effect without mutating task state. With more time, I would refactor the collaboration indicators into a dedicated animation layer so avatar movement between tasks could use a true FLIP-style transition instead of simple entry and exit animation on each card.

## Lighthouse

The codebase is structured to target a strong desktop Lighthouse score, but I did not generate a screenshot inside this environment. Please run Lighthouse locally against the production build and add the screenshot to the repository before submission.
