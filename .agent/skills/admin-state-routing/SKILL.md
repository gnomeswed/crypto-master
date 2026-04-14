---
name: admin-state-routing
description: Preserving dashboard state in URLs for shareability, persistence, and safe navigations.
---

# Admin State Routing (URL State)

Dashboards fail when state is locked purely in JavaScript variables. Admin systems must be stateless in memory and stateful in the URL for critical context.

## 1. The Core Principle
If a user applies a date filter, sorts a table, and navigates to page 3, they MUST be able to copy the URL, send it to a colleague, and the colleague will see exactly page 3 with those filters applied.

## 2. What belongs in the URL?
- Search queries (`?q=john`)
- Pagination states (`?page=3&limit=50`)
- Active Tabs (`?tab=settings`)
- Filter categories (`?status=active,pending`)
- Sorting (`?sort=createdAt&order=desc`)

## 3. Updating State Safely
- **Push vs Replace:** When updating search queries letter by letter, use `history.replaceState` or Next.js `router.replace` to avoid polluting the browser's back-button history.
- **Debouncing:** Input-based filtering should be debounced before pushing to the URL to prevent excessive renders/API calls.

## 4. Synchronizing URL -> Application
- **Single Source of Truth:** Read the URL params on mount and feed them directly into your data-fetching hooks (like React Query or SWR). Do not copy URL state into a local `useState` unless absolutely necessary for an optimistic controlled input.

## 5. Persistence
- **LocalStorage:** Only use localStorage for device-specific preferences like Sidebar state (open/collapsed) or Theme (dark/light). Do not store filter preferences here unless it's a global "Date Range" the user relies on across the whole app.
