---
name: advanced-table-management
description: High-performance data table patterns handling pagination, sorting, filtering, and large datasets.
---

# Advanced Table Management

Tables are the backbone of administration interfaces. Follow these rules to ensure they perform well and remain usable under heavy data loads.

## 1. Pagination vs Infinite Scroll
- **Server Pagination (Primary):** Use cursor-based or limit/offset server pagination for large datasets (e.g., thousands of orders).
- **Infinite Scroll:** Only use on social or feed-like admin views. For strict financial logic or order management, standard pagination is safer and avoids losing context.
- **Virtualization:** If rendering >100 rows locally, you MUST use Row Virtualization (e.g., `@tanstack/react-virtual`) to maintain 60FPS.

## 2. Critical UI Components of a Table
- **Sticky Headers:** If a user scrolls vertically, the table headers MUST stick to the top so they know what column they are looking at.
- **Bulk Selection:** Provide a master checkbox along with row-level checkboxes. Include floating action bars for bulk actions.
- **Empty States:** A table with 0 rows should not be completely blank. It needs an illustration, a "No data found" message, and a CTA (Create New).

## 3. Cell Formatting
- **Currencies/Numbers:** Must be right-aligned so decimal points line up for easy scanning.
- **Badges/Statuses:** Use pill badges with semantic background/text colors (e.g., Pending = Yellow/Orange, Fulfilled = Green, Failed = Red).
- **Truncation:** If strings are too long (like hashes or UUIDs), truncate with ellipsis and provide a "Copy to clipboard" icon or a tooltip.

## 4. Loading States
- **Skeleton Rows:** When loading, show skeleton rows with the exact heights of true rows. Avoid jarring layout shifts.
- **Global Table Spinner:** If refreshing, an overlay loader is acceptable, but skeleton rows are better for the initial load.
