# Ryn - Compliance Dashboard Desktop Application

A professional cross-platform desktop application built with Tauri, React, and TypeScript for monitoring code compliance, violations, and integrations.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Building](#building)
- [Architecture](#architecture)
- [Components](#components)
- [Contributing](#contributing)

## Overview

Ryn is a comprehensive compliance dashboard that helps development teams monitor code quality, track violations, manage integrations, and maintain security compliance across their projects. The application features an AI-powered assistant for intelligent compliance guidance.

## Features

- **📊 Dashboard Overview**: Real-time statistics and metrics visualization
- **🔍 Violations Tracking**: Comprehensive violation detection and management
- **🔗 CI/CD Integrations**: Support for GitHub Actions, GitLab CI/CD, Jenkins, and CircleCI
- **🤖 AI Assistant**: Intelligent chat-based compliance helper
- **📈 Analytics**: Detailed charts and trends for violations and fixes
- **🎨 Modern UI**: Beautiful, responsive design with dark theme
- **⚡ Performance**: Built with Rust-based Tauri for native performance
- **🔒 Security**: Desktop-first architecture with enhanced security

## Tech Stack

- **Frontend Framework**: React 18+ with TypeScript
- **Desktop Framework**: Tauri 2.x
- **Build Tool**: Vite 5+
- **Styling**: Custom CSS with CSS Modules
- **State Management**: React Hooks (useState, useEffect, etc.)
- **Icons**: Custom SVG components
- **Font**: Google Fonts - Outfit

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: Build essentials, webkit2gtk
  - **Windows**: Microsoft Visual Studio C++ Build Tools

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ryn/app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run tauri:dev
   ```

The application will open in a desktop window with hot-reload enabled.

## Project Structure

```
app/
├── src/
│   ├── components/          # React components
│   │   ├── Sidebar/         # Navigation sidebar
│   │   ├── Dashboard/       # Main dashboard page
│   │   ├── AIAssistant/     # AI chat panel
│   │   └── ui/              # Reusable UI components
│   │       ├── Icons.tsx    # SVG icon components
│   │       ├── Toast.tsx    # Toast notifications
│   │       └── Modal.tsx    # Modal dialogs
│   ├── pages/               # Page components
│   │   └── SimplePage.tsx   # Reusable page template
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Main types file
│   ├── styles/              # Global styles
│   │   └── globals.css      # Global CSS
│   ├── utils/               # Utility functions
│   ├── hooks/               # Custom React hooks
│   ├── App.tsx              # Main app component
│   ├── App.css              # App-level styles
│   ├── main.tsx             # Application entry point
│   └── vite-env.d.ts        # Vite type definitions
├── src-tauri/               # Tauri backend (Rust)
│   ├── src/
│   │   └── lib.rs           # Main Rust file
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── public/                  # Static assets
├── index.html               # HTML entry point
├── package.json             # Node dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

## Development

### Running the Application

```bash
# Development mode with hot-reload
npm run tauri:dev

# Run frontend only (browser)
npm run dev

# Type checking
npx tsc --noEmit
```

### Code Organization

**Components**: Each major component has its own folder containing:
- Component file (.tsx)
- Style file (.css)
- Supporting types/interfaces

**Best Practices**:
- Use TypeScript for type safety
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use CSS modules or scoped styles
- Follow naming conventions (PascalCase for components, camelCase for utilities)

### Adding New Features

1. **Create Component**:
   ```typescript
   // src/components/NewFeature/NewFeature.tsx
   import React from 'react';
   import './NewFeature.css';

   interface NewFeatureProps {
     // Define props
   }

   const NewFeature: React.FC<NewFeatureProps> = (props) => {
     return <div>Content</div>;
   };

   export default NewFeature;
   ```

2. **Add Types** (if needed):
   ```typescript
   // src/types/index.ts
   export interface NewFeatureType {
     // Define interface
   }
   ```

3. **Integrate in App**:
   ```typescript
   // src/App.tsx
   import NewFeature from './components/NewFeature/NewFeature';
   ```

## Building

### Build for Production

```bash
# Build the application
npm run tauri:build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`:
- **macOS**: .app, .dmg
- **Windows**: .msi, .exe
- **Linux**: .deb, .AppImage

### Build Configuration

Edit `src-tauri/tauri.conf.json` to customize:
- App name and version
- Window size and properties
- Build targets
- Update server
- Security permissions

## Architecture

### Application Flow

```
┌─────────────┐
│   main.tsx  │  Entry point
└──────┬──────┘
       │
┌──────▼──────┐
│   App.tsx   │  Main component, state management
└──────┬──────┘
       │
       ├───────┬──────────┬──────────┐
       │       │          │          │
┌──────▼───┐ ┌▼──────┐ ┌▼─────────┐ ┌▼────────┐
│ Sidebar  │ │ Pages │ │AIAssist. │ │ UI Comp.│
└──────────┘ └───────┘ └──────────┘ └─────────┘
```

### State Management

- **Page State**: Managed in App.tsx using useState
- **Component State**: Local state in individual components
- **Props Drilling**: Props passed through component tree
- **Future**: Consider Context API or state management library for complex state

### Styling Strategy

1. **Global Styles**: `globals.css` for app-wide styles
2. **Component Styles**: Scoped CSS files for each component
3. **Utility Classes**: Reusable classes for common patterns
4. **CSS Variables**: Defined in globals for theme consistency

## Components

### Core Components

**Sidebar**: Navigation menu with page selection and AI assistant trigger
- Features: Responsive, collapsible on mobile, active state tracking
- Props: `currentPage`, `onPageChange`, `onAIAssistantOpen`

**Dashboard**: Main overview page with stats, charts, and activity
- Features: Real-time stats, interactive charts, violations list
- Props: `onRunScan`

**AIAssistant**: Intelligent chat panel for compliance help
- Features: Chat history, quick actions, typing indicator
- Props: `isOpen`, `onClose`

**Toast**: Temporary notification system
- Features: Auto-dismiss, multiple types (success/error/info)
- Props: `message`, `type`, `show`, `onClose`

**Modal**: Dialog for confirmations and alerts
- Features: Overlay, customizable content, cancel/confirm actions
- Props: `isOpen`, `title`, `message`, `onConfirm`, `onCancel`

### UI Components

All icon components are located in `src/components/ui/Icons.tsx`:
- GridIcon, AlertTriangleIcon, CodeScanIcon, IntegrationsIcon
- HelpCircleIcon, UserIcon, SmileIcon, MenuIcon, XIcon
- And more...

## Contributing

### Development Workflow

1. Create a feature branch
2. Make changes following code style
3. Test thoroughly
4. Submit pull request

### Code Style

- Use TypeScript strict mode
- Follow React best practices
- Write meaningful component and variable names
- Add comments for complex logic
- Keep components under 300 lines
- Extract large components into smaller ones

### Testing

```bash
# Run type checking
npx tsc --noEmit

# Test build
npm run build

# Test production build
npm run tauri:build
```

## License

See [LICENSE](../LICENSE) file in the root directory.

## Support

For issues and questions:
- Open an issue on GitHub
- Check documentation
- Contact support team

---

Built with ❤️ by the Ryn Team
