# Ryn Technical Documentation

## Overview

This document provides in-depth technical information about the Ryn Compliance Dashboard desktop application architecture, implementation details, and best practices.

## Technology Stack

### Frontend

- **React 18.3+**: Component-based UI library
- **TypeScript 5.6+**: Static type checking
- **Vite 5.4+**: Build tool and dev server
- **CSS3**: Styling with modern features (Grid, Flexbox, Custom Properties)

### Desktop Framework

- **Tauri 2.x**: Lightweight desktop framework using Rust
- **Rust**: Backend language for system-level operations
- **WebView**: Native webview for rendering React UI

### Development Tools

- **npm**: Package manager
- **ESLint**: Code linting (optional)
- **TypeScript Compiler**: Type checking

## Architecture Deep Dive

### Component Architecture

#### 1. Sidebar Component

**File**: `src/components/Sidebar/Sidebar.tsx`

**Responsibilities**:
- Navigation menu rendering
- Page state management
- Mobile responsive behavior
- AI assistant trigger

**Key Features**:
- Dynamic active state based on currentPage
- Automatic mobile menu closing on navigation
- Responsive design (full width on desktop, collapsed on tablet, overlay on mobile)

**Props Interface**:
```typescript
interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onAIAssistantOpen: () => void;
  isOpen: boolean;
  onClose: () => void;
}
```

**State Management**:
- No internal state (fully controlled component)
- Receives state and callbacks from parent (App.tsx)

#### 2. Dashboard Component

**File**: `src/components/Dashboard/Dashboard.tsx`

**Responsibilities**:
- Display overview statistics
- Render interactive charts
- Show integrations table
- List recent violations
- Display activity feed

**Data Structures**:
```typescript
const stats = [
  { label, value, change, isPositive, icon }
];

const chartData: ChartData[] = [
  { label, violations, fixes }
];

const integrations: Integration[] = [
  { id, name, icon, tests, lastScan, status }
];
```

**Chart Implementation**:
- CSS-based bar chart using flexbox
- Dynamic height calculation based on data values
- Hover tooltips for detailed information
- Responsive scaling

#### 3. AI Assistant Component

**File**: `src/components/AIAssistant/AIAssistant.tsx`

**Responsibilities**:
- Chat interface rendering
- Message history management
- Quick action buttons
- Typing indicator animation

**State Management**:
```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [inputValue, setInputValue] = useState('');
const [isTyping, setIsTyping] = useState(false);
```

**Message Flow**:
1. User types message and clicks send
2. Message added to state
3. Typing indicator shown
4. Simulated AI response after delay
5. Response added to state
6. Auto-scroll to latest message

**Features**:
- Auto-scroll to bottom on new messages
- Enter key to send (Shift+Enter for newline)
- Disabled send button when input empty
- Quick action button integration

### State Management Strategy

**App-Level State** (`App.tsx`):
```typescript
const [currentPage, setCurrentPage] = useState<PageType>('overview');
const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
const [isSidebarOpen, setIsSidebarOpen] = useState(false);
const [toast, setToast] = useState({ show, message, type });
const [modal, setModal] = useState({ isOpen, title, message, onConfirm });
```

**Why This Approach?**:
- Simple application with manageable state
- Props drilling is minimal (1-2 levels)
- No complex state interactions
- Easy to understand and maintain

**Future Scalability**:
For larger applications, consider:
- React Context API for theme, user data
- State management library (Redux, Zustand, Jotai)
- React Query for server state

### Routing Implementation

**Current**: Simple conditional rendering based on `currentPage` state

```typescript
const renderPage = () => {
  switch (currentPage) {
    case 'overview': return <Dashboard />;
    case 'violations': return <SimplePage />;
    // ...
  }
};
```

**Why Not React Router?**:
- Desktop app with limited routes
- No URL management needed
- Simpler state management
- Faster page transitions

**Migration Path**:
If URL routing becomes necessary:
1. Install `react-router-dom`
2. Wrap App in `<BrowserRouter>`
3. Convert pages to `<Route>` components
4. Use `<Link>` for navigation

## Styling Architecture

### CSS Organization

**Global Styles** (`globals.css`):
- CSS Reset
- Font imports
- Base body styles
- Background gradients
- Utility classes
- Animations
- Responsive breakpoints

**Component Styles**:
- Each component has dedicated CSS file
- Scoped to component (via naming conventions)
- BEM-like naming: `.component-element`

### Design System

**Colors**:
```css
/* Primary Gold Gradient */
--gold-primary: #d4a574;
--gold-secondary: #c9985f;

/* Background */
--bg-primary: #1a1410;
--bg-secondary: #0d0a08;

/* Text */
--text-primary: #e8e8e8;
--text-secondary: #666;

/* Status */
--success: #7cb342;
--warning: #fbbf24;
--error: #ef4444;
```

**Typography**:
```css
/* Font Family */
font-family: 'Outfit', sans-serif;

/* Font Weights */
--fw-light: 300;
--fw-regular: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
--fw-extrabold: 800;
--fw-black: 900;
```

**Spacing Scale**:
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
--spacing-3xl: 48px;
```

**Border Radius**:
```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
```

### Responsive Design

**Breakpoints**:
```css
/* Mobile: < 480px */
@media (max-width: 480px) {
  /* Phone layout */
}

/* Tablet: < 768px */
@media (max-width: 768px) {
  /* Tablet layout */
}

/* Desktop: < 1024px */
@media (max-width: 1024px) {
  /* Small desktop layout */
}
```

**Mobile-First Approach**:
- Base styles for mobile
- Progressive enhancement for larger screens
- Touch-friendly targets (min 44x44px)
- Readable font sizes (min 14px)

## Type System

### Core Types

**File**: `src/types/index.ts`

```typescript
// Page routing
export type PageType = 'overview' | 'violations' | 'codescans' | 'integrations' | 'support' | 'account';

// Violation severity
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

// Status badges
export type StatusBadge = 'active' | 'warning' | 'inactive';

// Stat change direction
export type ChangeDirection = 'positive' | 'negative' | 'neutral';
```

### Interface Design

**Principle**: Interfaces for objects, Types for unions/primitives

```typescript
// Interface for object structure
export interface StatCard {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  changeDirection?: ChangeDirection;
  icon: string;
}

// Type for union
export type PageType = 'overview' | 'violations' | ...;
```

## Performance Optimizations

### 1. React Performance

**Memoization**: Not implemented yet, but consider:
```typescript
// Expensive calculations
const chartMax = useMemo(() =>
  Math.max(...chartData.map(d => Math.max(d.violations, d.fixes))),
  [chartData]
);

// Expensive components
const Dashboard = React.memo(DashboardComponent);
```

**Callback Optimization**:
```typescript
// Instead of inline functions
const handlePageChange = useCallback((page: PageType) => {
  setCurrentPage(page);
}, []);
```

### 2. Tauri Performance

**Benefits**:
- Rust backend is extremely fast
- Small bundle size (~5-10MB vs 100MB+ for Electron)
- Native system integration
- Lower memory footprint

**Optimization Tips**:
- Use Tauri commands for heavy operations
- Leverage Rust for file system operations
- Use web workers for intensive client-side tasks

### 3. CSS Performance

**Optimizations Applied**:
- Hardware-accelerated transforms
- Will-change hints for animations
- Efficient selectors (avoid deep nesting)
- CSS containment where applicable

## Security Considerations

### Tauri Security

**CSP (Content Security Policy)**:
Configure in `tauri.conf.json`:
```json
{
  "tauri": {
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com"
    }
  }
}
```

**Allowlist**:
Only enable required Tauri APIs:
```json
{
  "tauri": {
    "allowlist": {
      "fs": { "scope": ["$APPDATA/*"] },
      "shell": { "open": true }
    }
  }
}
```

### Frontend Security

**Best Practices**:
- No `dangerouslySetInnerHTML`
- Sanitize user inputs
- Use TypeScript for type safety
- Validate data before rendering
- No eval() or inline scripts

## Testing Strategy

### Unit Testing (Future)

**Recommended Tools**:
- Vitest (Vite-native testing)
- React Testing Library
- Jest (alternative)

**Example Test Structure**:
```typescript
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    render(<Sidebar {...props} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});
```

### Integration Testing

**Tools**:
- Playwright
- Cypress

**Test Scenarios**:
- Full user workflows
- Page navigation
- Modal interactions
- AI assistant chat

### End-to-End Testing

**Tauri Testing**:
- WebDriver integration
- Native automation tools
- CI/CD pipeline integration

## Build and Deployment

### Development Build

```bash
npm run tauri:dev
```

**What Happens**:
1. Vite starts dev server (port 1420)
2. Tauri compiles Rust code
3. Desktop window opens with hot-reload
4. Changes reflect immediately

### Production Build

```bash
npm run tauri:build
```

**Build Process**:
1. TypeScript compilation
2. Vite production build (minified, optimized)
3. Rust compilation (release mode)
4. Platform-specific bundling
5. Code signing (if configured)
6. Installer creation

**Output Location**:
```
src-tauri/target/release/bundle/
├── dmg/           # macOS disk image
├── macos/         # macOS .app
├── deb/           # Linux Debian package
├── appimage/      # Linux AppImage
├── msi/           # Windows installer
└── nsis/          # Windows NSIS installer
```

### CI/CD Integration

**GitHub Actions Example**:
```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run tauri:build
```

## Best Practices

### Component Design

1. **Single Responsibility**: One component, one job
2. **Composition**: Build complex UIs from simple components
3. **Props Interface**: Always define TypeScript interfaces
4. **Default Props**: Use default parameters for optional props
5. **Error Boundaries**: Wrap components in error boundaries (future)

### Code Organization

1. **Folder Structure**: Group by feature, not type
2. **File Naming**: PascalCase for components, camelCase for utilities
3. **Import Order**: External → Internal → Types → Styles
4. **Export Strategy**: Named exports preferred, default for main component

### State Management

1. **Lift State Up**: Share state at lowest common ancestor
2. **Derived State**: Calculate from existing state, don't duplicate
3. **Immutability**: Always create new objects/arrays for state updates
4. **Side Effects**: Use useEffect for side effects, keep components pure

### Performance

1. **Lazy Loading**: Code-split large components
2. **Memoization**: Use useMemo/useCallback for expensive operations
3. **Virtual Scrolling**: For long lists (implement if needed)
4. **Image Optimization**: Use appropriate formats and sizes

## Troubleshooting

### Common Issues

**Issue**: Tauri dev fails to start
**Solution**: Check Rust installation, run `rustc --version`

**Issue**: TypeScript errors
**Solution**: Run `npx tsc --noEmit` for detailed errors

**Issue**: Build fails on specific platform
**Solution**: Check platform-specific dependencies

**Issue**: Hot reload not working
**Solution**: Restart dev server, check Vite config

## Future Enhancements

### Planned Features

1. **Data Persistence**: Local storage for settings
2. **Real API Integration**: Connect to actual backend
3. **Advanced Charts**: More visualization options
4. **Theme Customization**: Light/dark mode toggle
5. **Keyboard Shortcuts**: Power user features
6. **Settings Panel**: User preferences
7. **Export Functionality**: Export reports as PDF/CSV
8. **Notifications**: System notifications for critical events

### Technical Improvements

1. **Test Coverage**: Add comprehensive test suite
2. **State Management**: Migrate to Context/Redux if needed
3. **Code Splitting**: Lazy load routes and components
4. **Performance Monitoring**: Add analytics and monitoring
5. **Accessibility**: ARIA labels, keyboard navigation
6. **Internationalization**: Multi-language support
7. **Error Tracking**: Sentry or similar integration
8. **Auto-Updates**: Tauri updater integration

## Appendix

### Useful Commands

```bash
# Development
npm run dev                 # Frontend only
npm run tauri:dev          # Full desktop app
npm run build              # Build frontend
npm run tauri:build        # Build desktop app

# Type Checking
npx tsc --noEmit           # Check TypeScript

# Cleanup
rm -rf node_modules        # Remove dependencies
npm install                # Reinstall dependencies
rm -rf src-tauri/target    # Clean Rust build
```

### Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

### Contact

For technical questions and support:
- GitHub Issues
- Technical documentation
- Developer community

---

Last Updated: 2025
Version: 1.0.0
