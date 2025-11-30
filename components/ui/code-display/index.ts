/**
 * Code Display Components
 *
 * Reusable syntax highlighting components for displaying code throughout Ryn.
 * All use react-syntax-highlighter with Prism and vscDarkPlus theme.
 *
 * @module components/ui/code-display
 */

export { CodeBlock } from "./code-block"
export { CodeSnippet } from "./code-snippet"
export { CodeDiff } from "./code-diff"
export { getLanguageFromPath, DEFAULT_CODE_STYLE, SNIPPET_CODE_STYLE } from "./utils"
