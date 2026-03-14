# Gemini Project Context: Portfolio Dashboard

## 🎨 Design Philosophy & UI Principles
This project adheres to a strict "Restrained Minimalism" aesthetic, heavily inspired by modern Apple design (macOS & iOS). Every AI assistant MUST follow these core principles when modifying the UI:

### 1. Visual Hierarchy & Spacing
- **Generous White Space**: Use large gaps (`gap-10`, `gap-12`, `py-10`) to create a sense of premium quality and focus.
- **Physical Centering**: Key content (like the Settings box) should be the absolute physical center of the layout. Navigational elements should sit to the side as "appendages" to the main content, balanced by invisible spacers.
- **Typography**: Prefer `Inter` or system fonts. Use `tracking-tight` for bold headers and `tabular-nums` for all financial data to ensure alignment.

### 2. Interaction Standards
- **Expandable Workspace (Accordion)**: For secondary editing tasks (e.g., changing email, updating password), **DO NOT** use modals if the context can be maintained. Instead, use a "smooth drawer" effect that pushes down subsequent content. 
  - *Implementation Hint*: Use CSS Grid (`grid-rows-[0fr] -> grid-rows-[1fr]`) for fluid height animations.
- **Translucency**: Use `backdrop-blur-xl` with semi-transparent backgrounds (`bg-white/70`) for sticky headers and high-level overlays to create depth.
- **Color Palette**: 
  - Primarily **Black** and **Gray** scale for UI elements.
  - **Red (`rose-500`)** is reserved EXCLUSIVELY for destructive actions (Logout, Delete, Loss).
  - **Emerald Green** for success states and positive returns.

### 3. Consistency & Restraint
- **Icon Usage**: Avoid unnecessary icons in lists or menus. Text should stand on its own.
- **Circular Primaries**: Use circular containers (`rounded-full`) for profile photos and company logos. Apply `object-cover` to fill the circle completely.

### 4. Micro-Interaction Standards
- **Active Icon Effect**: When a setting item is in "edit mode" or "active", its icon container MUST:
  - Scale slightly (`scale-110`).
  - Add a soft halo (`ring-4 ring-black/5`).
  - Transition icon color from `gray-400` to `black`.
  - Use `duration-300 ease-in-out` for all transitions to ensure a "premium" feel.
- **Destructive Actions**: Use `bg-rose-50/30` with `text-rose-500` for sign-out or delete buttons, adding a subtle icon translation (e.g., `group-hover:-translate-x-0.5`) on hover.

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
│   ├── settings/            # Dedicated settings layout (Account & Security unified)
│   ├── transactions/        # Transaction history list
│   └── page.tsx             # Home (Dashboard)
├── lib/                     # Shared utilities (Supabase, Finnhub)
└── hooks/                   # Custom React hooks (useStock, etc.)
```

### Important Implementation Details
- **Unified Identity**: Account settings and Security/Privacy are merged into a single "Account & Security" domain.
- **Data Flow**: Server Components fetch via Prisma -> Props passed to Client Components.
- **API Strategy**: External calls are proxied through server-side routes to protect keys.

---

## 📜 Development Commandments
- **NEVER** add a global state manager (Redux/Zustand) unless explicitly ordered.
- **NEVER** use TailwindCSS v4 features if the project is on v3 (and vice versa).
- **NEVER** perform any Git operations (add, commit, push, etc.) - all Git operations are handled by the user.
- **ALWAYS** check for `tabular-nums` when rendering currency or percentages.
- **ALWAYS** maintain the "Center-aligned White Box" layout for major management interfaces.
