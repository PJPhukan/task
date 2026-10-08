# Rolane Design Plan

## 1. Colour System

A restrained, high-contrast palette built for daily engineering and QA operations. Contrast meets WCAG AAA for body text and AA for controls. Flat surfaces with 1px hairline boundaries replace shadows.

### Base Palette
| Token | Role | Light Hex | Dark Hex |
|---|---|---|---|
| `brand` | Primary brand accent, active selection, primary button | `#0E5652` | `#1A8880` |
| `foreground` | Primary text, high-contrast glyphs | `#14191C` | `#ECF0F2` |
| `background` | Application canvas, viewport base | `#F8F9FA` | `#0E1214` |
| `surface` | Cards, panels, inputs, popovers | `#FFFFFF` | `#151B1E` |
| `border` | Hairline dividers, panel boundaries, input borders | `#DCE1E5` | `#252F35` |
| `muted` | Secondary text, inactive tabs, column counts | `#5D6B75` | `#8B9BA5` |

### Semantic Colours
| Purpose | Light Hex | Dark Hex | Notes |
|---|---|---|---|
| Priority: Low | `#5E6C79` | `#8F9CA7` | Neutral slate |
| Priority: Medium | `#2D728F` | `#5AA2C0` | Steel blue |
| Priority: High | `#C25E12` | `#E88636` | Burnt amber |
| Priority: Urgent | `#B82828` | `#EA5454` | Crimson red |
| Over time limit | `#942036` | `#E24D68` | Deep claret red; distinct from urgent |
| Success | `#1A7442` | `#33A865` | Forest green |
| Danger | `#B91C1C` | `#EE5252` | Alert red |

---

## 2. Typography

- **Family**: IBM Plex Sans (`next/font/google`). Designed for technical density, high legibility at 12–13px, and distinct glyphs (0 vs O, 1 vs l).
- **Tabular Numerals**: `font-feature-settings: 'tnum' 1` enabled globally for all numerals. Clock counters, task IDs, durations, and counts never jitter during updates.
- **No Monospace for Labels**: Status labels and tags use standard sans-serif with medium weight.

### Type Scale
| Level | Size / Line Height | Tracking | Weight | Usage |
|---|---|---|---|---|
| Micro | 11px / 14px | 0 | 500 | Column totals, stage metrics, ticket IDs |
| Caption | 12px / 16px | 0 | 400, 500 | Badges, secondary metadata, table headers |
| Base UI | 13px / 18px | 0 | 400, 500 | Ticket titles, table cells, sidebar links |
| Body | 14px / 20px | 0 | 400, 500 | Inputs, button text, dialog descriptions |
| Subheading | 16px / 22px | -0.01em | 600 | Card titles, column headers, dialog titles |
| Page Heading | 20px / 26px | -0.015em | 600 | Board titles, page headers |
| Display | 24px / 30px | -0.02em | 600 | Sign-in headline, primary view titles |

---

## 3. Spacing, Corner Radius, and Border Rules

- **Spacing Scale**: 4px base increments (4, 8, 12, 16, 20, 24, 32px).
  - Form field heights: 36px (h-9) with 12px horizontal padding.
  - Buttons: 36px height default, 28px height compact.
  - Kanban ticket padding: 12px vertical/horizontal.
- **Corner Radii**:
  - `rounded-sm` (2px): Buttons, form inputs, badges, select triggers.
  - `rounded` (4px): Cards, column containers, modal dialogs, flyout menus.
  - Radii never exceed 4px. No circular pills or bubbly containers.
- **Border Hierarchy**:
  - All cards, panels, inputs, and column containers use crisp 1px borders (`border border-border`).
  - No drop shadows anywhere (`shadow-none`). Depth and grouping are established entirely by surface background contrast and 1px borders.

---

## 4. Layout Concept & ASCII Wireframes

A high-density operational workbench partitioned into role-custody stages where task dwell times and handoff boundaries remain persistently visible across flat, hairline-bordered panels.

### App Shell Wireframe
```
+---------------------------------------------------------------------------------------+
| [Logo] Rolane  | Project: Core Platform v  | Search (/)             | [Theme] [User v] |
+-----------+---------------------------------------------------------------------------+
| My Tasks  | Board: Sprint 42                                 [Filter] [Group] [+ Task]|
| Projects  +---------------------------------------------------------------------------+
| - Core    | [DEV] To Do (3)     | [DEV] Doing (2)    | [QA] Testing (4)   | [OPS] Deploy(1)   |
| - Mobile  | | 2h limit          | | 4h limit         | | 1h limit         | | Done            |
| Reports   | +-----------------+ | +----------------+ | +----------------+ | +---------------+ |
| Settings  | | PROJ-102  1h 12m| | | PROJ-98  3h 40m| | | PROJ-88  1h 45m| | | PROJ-74       | |
|           | | Fix auth race   | | | Cache headers  | | | ! OVER LIMIT   | | | Migration v2  | |
|           | +-----------------+ | +----------------+ | +----------------+ | +---------------+ |
|           | +-----------------+ |                  | +----------------+ |                   |
|           | | PROJ-104    18m | |                  | | PROJ-90    22m | |                   |
|           | | Add indexes     | |                  | | API test suite | |                   |
|           | +-----------------+ |                  | +----------------+ |                   |
+-----------+---------------------------------------------------------------------------+
```

### Sign-in Screen Wireframe
```
+---------------------------------------------------------------------------------------+
|                                                                                       |
| +-----------------------------------------------------------------------------------+ |
| |                                        |                                          | |
| |  [Rolane Mark]                         |  Sign in to your account                 | |
| |  Rolane                                |  Enter your work email and password.     | |
| |                                        |                                          | |
| |  Role-driven task management for       |  Email address                           | |
| |  software teams.                       |  [ admin@example.com                   ] | |
| |                                        |                                          | |
| |  Columns belong to roles. Stage dwell  |  Password                                | |
| |  times and handoffs are tracked in     |  [ ....................                ] | |
| |  real time.                            |                                          | |
| |                                        |  [ Sign in                             ] | |
| |  - Developer to QA to Deployment       |                                          | |
| |  - Live column wait-time limits        |  Forgot password? Reset it here          | |
| |  - Backward moves require reasons      |  Need an account? Request access         | |
| |                                        |                                          | |
| +-----------------------------------------------------------------------------------+ |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 5. The One Memorable Element

**The Stage Custody & Wait-Time Meter**:
Every column features an authoritative, role-assigned spine on its left border and header (e.g. Developer in slate teal, QA in steel blue, Deployment in ochre amber) identifying which discipline currently holds custody of the work.

Inside each ticket, the dwell duration is continuously displayed with tabular numbers (`2h 14m`). The moment a ticket breaches the column's defined time limit, the timer changes into a high-visibility, stark `#942036` (dark: `#E24D68`) alert tag displaying `+45m over limit`. This immediately signals bottlenecks across the entire team without decorative noise.

---

## 6. Wording Rules

- **Sentence case**: All headings, labels, tooltips, and buttons use sentence case (e.g., "Sign in to your account", "Email address", "Check time limits").
- **Plain verbs**: Action triggers describe the direct operation ("Sign in", "Create task", "Send invite", "Copy link").
- **Problem-solution errors**: Error banners state exactly what failed and the resolution action (e.g., "Incorrect email or password. Verify your credentials or reset your password.").
- **No exclamation marks**: Completely prohibited in all states, errors, notices, and toasts.
- **No marketing filler**: Zero instances of "Welcome back!", "Nothing here yet!", or "Let's get started".
