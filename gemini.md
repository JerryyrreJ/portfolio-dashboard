# Gemini Project Context: Portfolio Dashboard

## 🎨 Design Philosophy & UI Principles
This project adheres to a strict "Restrained Minimalism" aesthetic, heavily inspired by modern Apple design (macOS & iOS). Every AI assistant MUST follow these core principles when modifying the UI:

### 1. Visual Hierarchy & Spacing
- **Generous White Space**: Use large gaps (`gap-10`, `gap-12`, `py-10`) to create a sense of premium quality and focus.
- **Physical Centering**: Key content (like the Settings box) should be the absolute physical center of the layout. Navigational elements should sit to the side as "appendages" to the main content, balanced by invisible spacers.
- **Typography**: Prefer `Inter` or system fonts. Use `tracking-tight` for bold headers and `tabular-nums` for all financial data to ensure alignment.

### 2. Restraint in Design
- **Icon Usage**: Avoid unnecessary icons in lists or menus. Text should stand on its own.
- **Color Palette**: 
  - Primarily **Black** and **Gray** scale for UI elements.
  - **Red (`rose-500`)** is reserved EXCLUSIVELY for destructive actions (Logout, Delete, Loss) and branding logos where specified.
  - **Emerald Green** for positive returns/gains.
- **Stock Icons**: Use circular containers (`rounded-full`) for company logos. Apply `object-cover` to fill the circle completely, avoiding the "square inside a circle" look.

### 3. Components & Interaction
- **Translucency**: Use `backdrop-blur-xl` with semi-transparent backgrounds (`bg-white/70`) for sticky headers and modals to create depth.
- **Soft Shadows**: Use `shadow-sm` for cards and `shadow-2xl` for deep overlays like dropdowns or modals.
- **Responsive Logic**: Maintain desktop "Inspector/Modal" styles but ensure layouts are ready for mobile adaptation (vertical stacking or full-screen sheets).

---

## 🏗️ Architecture (System Context)

### Directory Structure
```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   ├── components/          # UI Components
│   │   ├── settings/        # Settings specific components
│   │   └── AddTransactionModal.tsx
│   ├── stock/[ticker]/      # Stock detail (Server + Client)
│   ├── settings/            # Dedicated settings layout and pages
│   ├── transactions/        # Transaction history list
│   ├── page.tsx             # Home (Dashboard)
│   └── DashboardClient.tsx  # Main Dashboard logic
├── lib/                     # Shared utilities (Finnhub client, etc.)
└── hooks/                   # Custom React hooks
```

### Important Implementation Details
- **Data Flow**: Server Components fetch via Prisma -> Props passed to Client Components.
- **ID Strategy**: All IDs are CUID strings.
- **Type Safety**: Strictly typed transaction types `"BUY" | "SELL"`.
- **API Strategy**: Finnhub API calls are centralized in `lib/finnhub.ts` and proxied through server-side routes to protect keys.

---

## 📜 Development Commandments
- **NEVER** add a global state manager (Redux/Zustand) unless explicitly ordered.
- **NEVER** use TailwindCSS v4 features if the project is on v3 (and vice versa).
- **ALWAYS** check for `tabular-nums` when rendering currency or percentages.
- **ALWAYS** maintain the "Center-aligned White Box" layout for major management interfaces.
