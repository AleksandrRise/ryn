# Project Structure

## Root Organization
```
app/                    # Main application project
├── Assets/            # Application resources (icons, images)
├── ViewModels/        # MVVM view models
├── Views/             # XAML views and code-behind
├── Models/            # Data models (folder exists but empty)
├── App.axaml          # Application-level XAML
├── App.axaml.cs       # Application initialization and lifecycle
├── Program.cs         # Entry point
├── ViewLocator.cs     # Convention-based view resolution
└── app.csproj         # Project file
```

## Architecture Pattern: MVVM

### ViewModels
- Located in `app/ViewModels/`
- Inherit from `ViewModelBase` (which extends `ObservableObject` from CommunityToolkit.Mvvm)
- Naming convention: `*ViewModel.cs`
- Handle business logic and data binding

### Views
- Located in `app/Views/`
- XAML files (`.axaml`) define UI structure
- Code-behind files (`.axaml.cs`) handle view-specific logic
- Naming convention: `*Window.axaml` or `*View.axaml`
- Use `x:DataType` attribute for compiled bindings

### View Resolution
- `ViewLocator.cs` automatically maps ViewModels to Views by convention
- Replaces "ViewModel" with "View" in the type name
- Example: `MainWindowViewModel` → `MainWindow`

## Key Conventions
- XAML files use `.axaml` extension (Avalonia XAML)
- Views are bound to ViewModels via DataContext
- Compiled bindings are preferred (enabled by default)
- FluentTheme is the default UI theme
- Application follows system theme variant by default
