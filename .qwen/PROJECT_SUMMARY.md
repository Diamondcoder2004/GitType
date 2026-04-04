I need to create a comprehensive markdown summary of the entire GitType project based on the conversation history. Let me organize all the key information systematically.# Project Summary

## Overall Goal
Transform GitType into a polished, IDE-like typing trainer for real code from GitHub repositories, matching the UX quality of Monkeytype with the visual clarity of VS Code.

## Key Knowledge

### Technology Stack
- **Frontend:** React 18 + TypeScript, Vite 5, Zustand (state management)
- **Styling:** CSS modules, no CSS framework
- **Testing:** Vitest (pre-existing config issue with path aliases — tests fail but `npm run build` succeeds)
- **GitHub API:** @octokit/rest for repo/file access

### Architecture
```
web/src/
├── components/     # Settings, UI
├── core/
│   ├── ast/        # Language adapters (TypeScript, Python, Markdown, YAML, Dockerfile, Vue, Universal)
│   ├── github/     # GitHub client
│   ├── repository/ # File tree builder
│   └── typing/     # typingEngine, statsEngine, diffEngine
├── features/
│   ├── file-tree/  # File tree sidebar
│   ├── repo-selection/ # RepoSelector (compact + large variants)
│   └── trainer/    # Trainer + CharSpan (React.memo)
├── store/          # Zustand appStore
└── tests/          # Unit tests (adapters.test.ts)
```

### Layout Structure
- **Header** (44px): Logo + RepoSelector (compact) or repo badge + Settings button
- **Left Sidebar** (260px, resizable 180–600px, collapsible): File tree
- **Main Content**: Welcome screen → No-file screen → Trainer
- **Right Sidebar** (200px, resizable 160–400px, hidden < 1400px): Languages + file info
- **No footer** — hints moved into Trainer's `hint-bar`

### Key Decisions
- **Tab** inserts 4 spaces (like IDE), **Escape** resets typing
- **Backspace** supports hold-to-repeat (300ms delay, 60ms interval) and **Ctrl+Backspace** deletes whole word
- **Sidebar collapsed by default** is `false` — auto-expands when files loaded
- **Resizable sidebars** via drag handles, widths saved to `localStorage`
- **Dash normalization** — all Unicode dash variants (en-dash, em-dash, minus sign, etc.) normalized to hyphen-minus `-` for comparison and display
- **Settings auto-save** to `localStorage` on every change (no alert)
- **GitHub token** managed in both welcome screen and Settings modal
- **Focus recovery** — any printable keypress auto-focuses typing area (Monkeytype behavior)

### Supported File Formats (10+ types)
| Format | Extensions | Adapter |
|--------|-----------|---------|
| Markdown | `.md`, `.mdx`, `.markdown` | `markdown.adapter.ts` |
| YAML/JSON/TOML | `.yaml`, `.yml`, `.json`, `.toml`, `.ini` | `yaml.adapter.ts` |
| Dockerfile | `Dockerfile`, `Dockerfile.*`, `Containerfile` | `dockerfile.adapter.ts` |
| Vue/Svelte | `.vue`, `.svelte` | `vue.adapter.ts` |
| HTML/XML | `.html`, `.htm`, `.xml` | `universal.adapter.ts` |
| CSS/SCSS | `.css`, `.scss`, `.sass`, `.less` | `universal.adapter.ts` |
| SQL | `.sql` | `universal.adapter.ts` |
| Shell | `.sh`, `.bash`, `.zsh` | `universal.adapter.ts` |
| Others | `.lua`, `.dart`, `.r`, `.tf`, `.graphql`, `.proto` | `universal.adapter.ts` |

### IDE Features (Optional, via Settings)
- **Bracket pair colorization** — `()` yellow, `[]` purple, `{}` blue
- **Indentation guides** — vertical lines at each indent level
- **Highlight next character** — yellow background + underline on current char

### Build Commands
```bash
cd web
npm run dev        # Dev server on :3000
npm run build      # tsc + vite build (always passes)
npm run preview    # Production preview
npm test           # vitest (pre-existing config issue — fails on all tests)
```

### User Preferences
- Output language: **Russian**
- Wants Monkeytype-level UX + IDE-level visual clarity
- Wants all features to be **optional/configurable**
- Prefers larger typing area, compact chrome

## Recent Actions

### Completed
1. **[DONE]** Full layout redesign — header/footer/left sidebar/right sidebar with resize handles
2. **[DONE]** Welcome screen with inline token + repo input (RepoSelectorLarge)
3. **[DONE]** Header shows compact repo input when no repo, badge when loaded
4. **[DONE]** Token management moved to Settings + welcome screen (auto-save)
5. **[DONE]** Tab = 4 spaces (IDE behavior), Escape = reset
6. **[DONE]** Line numbers in Trainer
7. **[DONE]** Code split by lines for horizontal scroll
8. **[DONE]** Compact live stats bar (wpm, cpm, acc, err, time, progress%)
9. **[DONE]** Next Block button after completion
10. **[DONE]** Bracket pair colorization (optional)
11. **[DONE]** Indentation guides (optional)
12. **[DONE]** Highlight next character (optional)
13. **[DONE]** Dash normalization — fixes `-` always showing as error
14. **[DONE]** Focus recovery — any keypress focuses typing area
15. **[DONE]** Settings: focus trap + Escape to close
16. **[DONE]** Resizable sidebars with drag handles (saved to localStorage)
17. **[DONE]** 15+ unit tests for all adapters (adapters.test.ts)
18. **[DONE]** Pending color improved to `#a1a1aa` without opacity
19. **[DONE]** Line-height reduced to 1.55 for more code visibility

### Discovered Issues
- Vitest tests fail with `TypeError: Cannot read properties of undefined (reading 'config')` — pre-existing issue with Vitest 4.x + path aliases + react plugin. Build always succeeds.
- Chrome/Edge not available on user's system — MCP browser testing unavailable

## Current Plan

1. [DONE] Layout redesign with resizable sidebars
2. [DONE] Token + repo input on welcome screen
3. [DONE] IDE features (bracket colors, indent guides, next char highlight)
4. [DONE] Dash normalization fix
5. [DONE] Line numbers + per-line rendering
6. [DONE] Compact stats + completion actions
7. [TODO] Syntax highlighting (Prism or Shiki integration)
8. [TODO] Minimap (optional, like VS Code)
9. [TODO] Results screen with detailed stats after completion
10. [TODO] Fix Vitest test configuration
11. [TODO] Docker-based backend (Redis/database) for persistent user data
12. [TODO] Sound feedback for errors (optional, setting exists but not implemented)

---

## Summary Metadata
**Update time**: 2026-04-04T08:23:50.433Z 
