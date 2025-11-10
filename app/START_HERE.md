# 🚀 Quick Start Guide - Ryn Compliance Dashboard

Welcome to Ryn! This guide will get you up and running in minutes.

## ⚡ Quick Start (3 Steps)

### 1. Install Dependencies

```bash
cd app
npm install
```

This will install all required packages including React, Tauri, TypeScript, and Vite.

### 2. Run the Application

```bash
npm run tauri:dev
```

The application will open in a desktop window. Hot-reload is enabled, so any changes you make will reflect immediately.

### 3. Start Developing!

The application is now running. You can:
- Navigate through different pages using the sidebar
- Open the AI Assistant by clicking the button at the bottom of the sidebar
- Click "Run Scan" to see the confirmation modal
- Explore the dashboard with stats, charts, and activity feed

## 📁 Project Structure

```
app/
├── src/
│   ├── components/      # All React components
│   ├── pages/           # Page components
│   ├── types/           # TypeScript types
│   ├── styles/          # Global styles
│   ├── App.tsx          # Main app
│   └── main.tsx         # Entry point
├── src-tauri/           # Tauri (Rust) backend
├── package.json         # Dependencies
└── README.md            # Full documentation
```

## 🎨 Key Features

### Sidebar Navigation
- Click any navigation item to switch pages
- On mobile, use the hamburger menu (☰) to open the sidebar
- The active page is highlighted in gold

### Dashboard
- View real-time statistics
- Interactive bar chart with hover tooltips
- Integrations table
- Recent violations list
- Activity feed

### AI Assistant
- Click the "AI Assistant" button in the sidebar
- Type questions or click quick action buttons
- Chat interface with message history
- Close with the X button

### Modals & Toasts
- Click "Run Scan" to see a confirmation modal
- Modals have confirm/cancel actions
- Toast notifications appear for 3 seconds after actions

## 🔧 Development Commands

```bash
# Development
npm run dev              # Frontend only (browser)
npm run tauri:dev        # Desktop app with hot-reload

# Building
npm run build            # Build frontend
npm run tauri:build      # Build desktop app (creates installer)

# Type Checking
npx tsc --noEmit         # Check for TypeScript errors
```

## 📝 Making Changes

### Add a New Page

1. Create a component in `src/pages/`:
```typescript
// src/pages/NewPage.tsx
import React from 'react';

const NewPage: React.FC = () => {
  return (
    <div className="page-container">
      <div className="header">
        <h1 className="page-title">New Page</h1>
      </div>
      <div className="content">
        <div className="card">
          <p>Your content here</p>
        </div>
      </div>
    </div>
  );
};

export default NewPage;
```

2. Add route in `src/types/index.ts`:
```typescript
export type PageType = 'overview' | 'violations' | 'newpage' | ...;
```

3. Add navigation item in `src/components/Sidebar/Sidebar.tsx`

4. Add route in `src/App.tsx`:
```typescript
case 'newpage':
  return <NewPage />;
```

### Modify Styles

- **Global styles**: Edit `src/styles/globals.css`
- **Component styles**: Edit the `.css` file next to each component
- **Colors**: Update CSS variables in `globals.css`

### Add New Icons

Add to `src/components/ui/Icons.tsx`:
```typescript
export const NewIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24">
    {/* SVG path here */}
  </svg>
);
```

## 🐛 Troubleshooting

### Application Won't Start

**Error**: `npm run tauri:dev` fails
**Solution**:
1. Check Rust is installed: `rustc --version`
2. Install Rust: https://www.rust-lang.org/tools/install
3. Install system dependencies (see README.md)

**Error**: Port 1420 already in use
**Solution**:
1. Kill the process: `lsof -ti:1420 | xargs kill`
2. Or change port in `vite.config.ts`

### TypeScript Errors

**Error**: Type errors in IDE
**Solution**:
1. Run `npx tsc --noEmit` to see all errors
2. Check `tsconfig.json` is properly configured
3. Restart TypeScript server in your IDE

### Build Failures

**Error**: `npm run build` fails
**Solution**:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Try building again

### Styling Issues

**Issue**: Styles not applying
**Solution**:
1. Check import order in component
2. Ensure CSS file is imported after component imports
3. Check for typos in class names
4. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)

## 🎯 Next Steps

### Learn the Codebase

1. Read [README.md](./README.md) for overview
2. Read [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) for deep dive
3. Explore component files to understand structure
4. Check `src/types/index.ts` for data models

### Customize the App

1. **Change Colors**: Edit CSS variables in `globals.css`
2. **Modify Layout**: Edit grid/flexbox in component CSS files
3. **Add Features**: Follow examples in existing components
4. **Connect Backend**: Add API calls in components

### Build for Production

```bash
# Create production build
npm run tauri:build

# Find installers in:
src-tauri/target/release/bundle/
```

Platform-specific installers will be created:
- **macOS**: .app and .dmg files
- **Windows**: .msi and .exe files
- **Linux**: .deb and .AppImage files

## 📚 Resources

- **Tauri Docs**: https://tauri.app/
- **React Docs**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/

## 💡 Tips & Tricks

### Keyboard Shortcuts

While in dev mode:
- **Cmd/Ctrl + R**: Reload window
- **Cmd/Ctrl + Shift + I**: Open DevTools (if enabled)
- **Cmd/Ctrl + Q**: Quit application

### Development Workflow

1. Keep `npm run tauri:dev` running
2. Make changes in your code editor
3. Save file → App updates automatically
4. Check console for errors
5. Use React DevTools for debugging

### Code Style

- Use **TypeScript** for all new files
- Follow **PascalCase** for components
- Use **camelCase** for functions and variables
- Add **JSDoc comments** for complex functions
- Keep components **focused** and **small**

### Performance

- Use `React.memo()` for expensive components
- Use `useMemo()` for expensive calculations
- Use `useCallback()` for event handlers passed to children
- Avoid inline object/array creation in render

## 🆘 Getting Help

- Check documentation files first
- Search existing issues on GitHub
- Open a new issue with:
  - Clear description
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshots if applicable

---

## ✅ Checklist

Before you start developing:

- [ ] Installed Node.js 18+
- [ ] Installed Rust (for Tauri)
- [ ] Ran `npm install` successfully
- [ ] Ran `npm run tauri:dev` successfully
- [ ] Application opened in desktop window
- [ ] Read README.md
- [ ] Explored the codebase

Happy coding! 🎉

---

**Need more help?** Check:
- [README.md](./README.md) - Full documentation
- [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - Technical deep dive
