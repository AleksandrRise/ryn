# Ryn Application Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Desktop Window                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                      Tauri Shell                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              WebView (React App)                │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌───────────┐  ┌──────────────────────────┐   │  │  │
│  │  │  │  Sidebar  │  │      Main Content       │   │  │  │
│  │  │  │           │  │                          │   │  │  │
│  │  │  │  - Nav    │  │  ┌────────────────────┐  │   │  │  │
│  │  │  │  - Logo   │  │  │   Current Page     │  │   │  │  │
│  │  │  │  - AI Btn │  │  │   (Dashboard, etc) │  │   │  │  │
│  │  │  │           │  │  └────────────────────┘  │   │  │  │
│  │  │  └───────────┘  └──────────────────────────┘   │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌──────────────────────────────────────────┐  │  │  │
│  │  │  │      AI Assistant Panel (Overlay)        │  │  │  │
│  │  │  │  - Chat Interface                        │  │  │  │
│  │  │  │  - Quick Actions                         │  │  │  │
│  │  │  │  - Message History                       │  │  │  │
│  │  │  └──────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕
                   Rust Backend
                   (Tauri Core)
```

## Component Hierarchy

```
App.tsx (Root Component)
│
├── Mobile Menu Button
│
├── Sidebar
│   ├── Logo
│   ├── Navigation Section
│   │   ├── Overview Item
│   │   ├── Violations Item
│   │   ├── Code Scans Item
│   │   └── Integrations Item
│   ├── Account Section
│   │   ├── Support Item
│   │   └── My Account Item
│   └── AI Assistant Trigger Button
│
├── Main Content Area (Current Page)
│   │
│   ├── Dashboard (Overview)
│   │   ├── Header
│   │   │   ├── Page Title
│   │   │   └── Run Scan Button
│   │   └── Content
│   │       ├── Stats Grid
│   │       │   ├── Stat Card (Total Scans)
│   │       │   ├── Stat Card (Violations)
│   │       │   ├── Stat Card (Fixed Issues)
│   │       │   └── Stat Card (Compliance)
│   │       ├── Main Grid
│   │       │   ├── Chart Card
│   │       │   │   ├── Card Header (Tabs)
│   │       │   │   ├── Bar Chart
│   │       │   │   └── Legend
│   │       │   └── Integrations Card
│   │       │       ├── Card Header
│   │       │       └── Integrations Table
│   │       └── Bottom Grid
│   │           ├── Violations Card
│   │           │   └── Violations List
│   │           └── Activity Card
│   │               └── Activity Feed
│   │
│   ├── Violations Page (SimplePage)
│   ├── Code Scans Page (SimplePage)
│   ├── Integrations Page (SimplePage)
│   ├── Support Page (SimplePage)
│   └── Account Page (SimplePage)
│
├── AI Assistant Panel
│   ├── Header
│   │   ├── Avatar & Title
│   │   └── Close Button
│   ├── Quick Actions
│   │   └── Quick Action Buttons
│   ├── Chat Container
│   │   ├── Message (User)
│   │   ├── Message (Assistant)
│   │   └── Typing Indicator
│   └── Input Container
│       ├── Text Input
│       └── Send Button
│
├── Toast Notification
│
└── Modal Dialog
    ├── Header (Icon & Title)
    ├── Content
    └── Actions (Cancel & Confirm)
```

## Data Flow

### Page Navigation

```
User clicks nav item
        ↓
Sidebar.tsx → onPageChange(page)
        ↓
App.tsx → setCurrentPage(page)
        ↓
renderPage() determines component
        ↓
Component renders in main area
```

### AI Assistant Interaction

```
User clicks AI button
        ↓
Sidebar.tsx → onAIAssistantOpen()
        ↓
App.tsx → setIsAIAssistantOpen(true)
        ↓
AIAssistant.tsx → isOpen={true}
        ↓
Panel slides in from right
        ↓
User types message
        ↓
AIAssistant.tsx → handleSendMessage()
        ↓
Message added to state
        ↓
Simulated AI response
        ↓
Response added to state
        ↓
Auto-scroll to bottom
```

### Modal/Toast Flow

```
User clicks "Run Scan"
        ↓
Dashboard.tsx → onRunScan()
        ↓
App.tsx → setModal({ isOpen: true, ... })
        ↓
Modal.tsx renders
        ↓
User clicks confirm
        ↓
Modal.tsx → onConfirm()
        ↓
App.tsx → setToast({ show: true, ... })
        ↓
Toast.tsx renders
        ↓
After 3 seconds → Toast closes
```

## State Management

### App-Level State (App.tsx)

```typescript
┌─────────────────────────────────────────┐
│          App.tsx State                  │
├─────────────────────────────────────────┤
│ currentPage: PageType                   │
│ isAIAssistantOpen: boolean              │
│ isSidebarOpen: boolean                  │
│ toast: { show, message, type }          │
│ modal: { isOpen, title, message, ... }  │
└─────────────────────────────────────────┘
        │
        ├─→ Props to Sidebar
        ├─→ Props to AIAssistant
        ├─→ Props to Toast
        └─→ Props to Modal
```

### Component-Level State

```
AIAssistant.tsx
├── messages: ChatMessage[]
├── inputValue: string
└── isTyping: boolean

Dashboard.tsx
└── activeTab: 'weekly' | 'monthly' | 'yearly'

(Other components are stateless)
```

## File Structure Deep Dive

```
app/
├── public/                      # Static assets
├── src/
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx      # Sidebar component
│   │   │   └── Sidebar.css      # Sidebar styles
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx    # Dashboard component
│   │   │   └── Dashboard.css    # Dashboard styles
│   │   ├── AIAssistant/
│   │   │   ├── AIAssistant.tsx  # AI panel component
│   │   │   └── AIAssistant.css  # AI panel styles
│   │   └── ui/
│   │       ├── Icons.tsx        # SVG icon components
│   │       ├── Toast.tsx        # Toast component
│   │       ├── Toast.css        # Toast styles
│   │       ├── Modal.tsx        # Modal component
│   │       └── Modal.css        # Modal styles
│   ├── pages/
│   │   └── SimplePage.tsx       # Reusable page template
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── styles/
│   │   └── globals.css          # Global styles
│   ├── hooks/                   # Custom hooks (empty for now)
│   ├── utils/                   # Utility functions (empty for now)
│   ├── App.tsx                  # Root component
│   ├── App.css                  # App styles
│   ├── main.tsx                 # Entry point
│   └── vite-env.d.ts            # Vite types
├── src-tauri/                   # Tauri (Rust) backend
│   ├── src/
│   │   └── lib.rs               # Main Rust file
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── icons/                   # App icons
├── index.html                   # HTML template
├── package.json                 # Node dependencies
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite config
├── README.md                    # Documentation
├── TECHNICAL_DOCUMENTATION.md   # Technical guide
├── START_HERE.md                # Quick start guide
└── ARCHITECTURE.md              # This file
```

## Technology Stack Layers

```
┌─────────────────────────────────────────┐
│         User Interface Layer            │
│  React Components + TypeScript + CSS   │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Application Logic Layer            │
│   State Management + Event Handlers    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Build & Bundle Layer               │
│      Vite (Development & Build)         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│         WebView Layer                   │
│    Native WebView (Platform-specific)   │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│         Tauri Core Layer                │
│       Rust Backend + IPC Bridge         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Operating System Layer             │
│    macOS / Windows / Linux APIs         │
└─────────────────────────────────────────┘
```

## Communication Patterns

### Component Communication

```
Parent Component (App.tsx)
        │
        ├─→ Props Down
        │   (Data flows to children)
        │
        └─← Callbacks Up
            (Events flow to parent)

Example:
App.tsx sends currentPage → Sidebar
Sidebar sends onPageChange() ← App.tsx
```

### Tauri IPC (Inter-Process Communication)

```
Frontend (React)          Backend (Rust)
     │                         │
     ├─── invoke() ────────────▶│
     │   (Call Rust function)   │
     │                          │
     │◀──── emit() ─────────────┤
     │   (Receive event)        │
     │                          │
```

*Note: IPC is not heavily used yet, but available for future features*

## Styling Architecture

### CSS Cascade

```
globals.css (Base styles)
     │
     ├─→ Reset & Normalize
     ├─→ Font imports
     ├─→ CSS variables
     ├─→ Utility classes
     └─→ Animations

Component.css (Component styles)
     │
     ├─→ Component-specific rules
     ├─→ BEM-like naming
     └─→ Media queries
```

### Responsive Strategy

```
Mobile First
     │
     ├─→ Base: < 480px (Mobile)
     │
     ├─→ @media (max-width: 768px) (Tablet)
     │   └─→ Adjust layouts, font sizes
     │
     ├─→ @media (max-width: 1024px) (Desktop)
     │   └─→ Optimize for larger screens
     │
     └─→ Default: > 1024px (Large Desktop)
         └─→ Full layout with all features
```

## Build Process

### Development Build

```
npm run tauri:dev
     │
     ├─→ Vite starts dev server (port 1420)
     │   ├─→ Compile TypeScript
     │   ├─→ Bundle React components
     │   └─→ Serve with HMR
     │
     └─→ Tauri starts
         ├─→ Compile Rust code
         ├─→ Create webview window
         └─→ Load http://localhost:1420
```

### Production Build

```
npm run tauri:build
     │
     ├─→ npm run build (Frontend)
     │   ├─→ TypeScript compilation
     │   ├─→ Vite production build
     │   │   ├─→ Minification
     │   │   ├─→ Tree shaking
     │   │   └─→ Code splitting
     │   └─→ Output to dist/
     │
     └─→ Tauri build (Backend)
         ├─→ Rust compilation (release mode)
         ├─→ Bundle frontend assets
         ├─→ Create platform installer
         │   ├─→ macOS: .app, .dmg
         │   ├─→ Windows: .msi, .exe
         │   └─→ Linux: .deb, .AppImage
         └─→ Output to src-tauri/target/release/bundle/
```

## Security Model

```
┌─────────────────────────────────────────┐
│            Frontend (React)             │
│     Sandboxed WebView Environment       │
└────────────┬────────────────────────────┘
             │
        Controlled
          Bridge
             │
┌────────────▼────────────────────────────┐
│          Tauri Core (Rust)              │
│      Allowlist & Permissions            │
└────────────┬────────────────────────────┘
             │
        Safe APIs
          Only
             │
┌────────────▼────────────────────────────┐
│       Operating System                  │
│    (File System, Network, etc.)         │
└─────────────────────────────────────────┘
```

## Performance Considerations

### React Optimization Points

```
Component Rendering
     │
     ├─→ Use React.memo() for expensive components
     ├─→ Use useMemo() for expensive calculations
     ├─→ Use useCallback() for stable function references
     └─→ Avoid inline object creation in props
```

### Bundle Optimization

```
Vite Build
     │
     ├─→ Tree shaking (Remove unused code)
     ├─→ Code splitting (Lazy load routes)
     ├─→ Minification (Reduce file size)
     └─→ Compression (Gzip/Brotli)
```

## Extension Points

### Adding New Features

```
1. New Page Type
   ├─→ Add to types/index.ts
   ├─→ Create component in pages/
   ├─→ Add nav item in Sidebar
   └─→ Add route in App.tsx

2. New API Integration
   ├─→ Create Tauri command in Rust
   ├─→ Call from React via invoke()
   └─→ Handle response

3. New UI Component
   ├─→ Create in components/ui/
   ├─→ Add styles
   ├─→ Export from index
   └─→ Use in pages
```

---

## Diagram Legend

- `│` = Relationship/Flow
- `├─→` = Branches to
- `└─→` = Final branch
- `↓` = Downward flow
- `↑` = Upward flow
- `↕` = Bidirectional flow
- `◀─` = Returns to

---

Last Updated: 2025
Version: 1.0.0
