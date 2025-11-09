# Technology Stack

## Framework & Runtime
- .NET 9.0
- Avalonia UI 11.3.8 (cross-platform desktop UI framework)
- Target: Desktop applications (Windows/macOS/Linux)

## Key Libraries
- **Avalonia.Desktop**: Desktop platform support
- **Avalonia.Themes.Fluent**: Fluent design theme
- **Avalonia.Fonts.Inter**: Inter font family
- **Avalonia.Diagnostics**: Debug-only diagnostics tools
- **CommunityToolkit.Mvvm 8.2.1**: MVVM helpers and observable objects

## Build System
- MSBuild (.csproj project files)
- SDK: Microsoft.NET.Sdk

## Common Commands

### Build
```bash
dotnet build app/app.csproj
```

### Run
```bash
dotnet run --project app/app.csproj
```

### Clean
```bash
dotnet clean app/app.csproj
```

### Restore Dependencies
```bash
dotnet restore app/app.csproj
```

## Project Configuration
- Nullable reference types enabled
- Compiled bindings enabled by default (`AvaloniaUseCompiledBindingsByDefault`)
- Built-in COM interop support enabled
- Output type: Windows executable (WinExe)
