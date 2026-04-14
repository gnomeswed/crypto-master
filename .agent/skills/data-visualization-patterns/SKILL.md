---
name: data-visualization-patterns
description: Principles for displaying metrics, charts, and financial data in dashboards clearly and without cognitive overload.
---

# Data Visualization Patterns

This skill provides guidelines and strict rules for designing charts, KPIs, and metric cards in Admin Panels and Dashboards.

## 1. The KPI Card Constraints
- **Hierarchy:** Never make all cards the same size if one metric is vastly more important than others (e.g., "Total Revenue" vs "Pending Checkouts").
- **Delta Requirement:** A number without context is useless. Every KPI card MUST show a delta/comparison (e.g., "+15% vs Last Month").
- **Semantic Colors:** Never use primary brand colors for deltas. Increase in bad metrics (like cart abandonment) is RED. Increase in good metrics is GREEN.

## 2. Chart Decisions
- **Line Charts:** Use ONLY for showing trends across a sequence (typically time). Avoid more than 4 lines on a single chart.
- **Bar Charts:** Best for categorical comparisons (e.g., Revenue by Product Category). Use Horizontal Bars if category names are long.
- **Pie / Donut Charts:** DO NOT USE for comparing values that are close in size. ONLY use for showing clear composition (max 5 slices).
- **No 3D:** Under NO circumstance use 3D charts or heavy drop shadows inside chart canvases.

## 3. The "Wall of Numbers" Anti-Pattern
- **Rule:** Never display more than 6 KPI cards in a single row or block without visual separation.
- **Micro-charts:** Consider adding Sparklines (mini un-labeled line charts) behind/under KPI numbers to give immediate historical context without taking up canvas space.

## 4. Tooltips and Interactivity
- Hovering over a chart must yield precise figures.
- Tooltips must not be cut off by the browser window.
- Ensure that the charting library is fully responsive; charts must re-render on window resize.
