// Catppuccin Mocha color palette for file type icons
const C = {
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
  text: '#cdd6f4',
  overlay1: '#7f849c',
  subtext1: '#bac2de',
}

interface FileIcon {
  icon: string
  color: string
}

const EXT_MAP: Record<string, FileIcon> = {
  // Languages
  ts: { icon: 'TS', color: C.blue },
  tsx: { icon: 'TX', color: C.sapphire },
  js: { icon: 'JS', color: C.yellow },
  jsx: { icon: 'JX', color: C.peach },
  py: { icon: 'PY', color: C.green },
  rb: { icon: 'RB', color: C.red },
  go: { icon: 'GO', color: C.sky },
  rs: { icon: 'RS', color: C.peach },
  java: { icon: 'JV', color: C.red },
  kt: { icon: 'KT', color: C.mauve },
  c: { icon: 'C', color: C.sapphire },
  cpp: { icon: 'C+', color: C.blue },
  h: { icon: 'H', color: C.lavender },
  cs: { icon: 'C#', color: C.green },
  php: { icon: 'PH', color: C.mauve },
  swift: { icon: 'SW', color: C.peach },
  lua: { icon: 'LU', color: C.blue },
  r: { icon: 'R', color: C.sapphire },
  dart: { icon: 'DA', color: C.sky },
  zig: { icon: 'ZG', color: C.peach },
  ex: { icon: 'EX', color: C.mauve },
  exs: { icon: 'EX', color: C.mauve },
  erl: { icon: 'ER', color: C.red },
  hs: { icon: 'HS', color: C.mauve },
  ml: { icon: 'ML', color: C.peach },
  clj: { icon: 'CL', color: C.green },

  // Web
  html: { icon: 'HT', color: C.peach },
  htm: { icon: 'HT', color: C.peach },
  css: { icon: 'CS', color: C.blue },
  scss: { icon: 'SC', color: C.pink },
  sass: { icon: 'SA', color: C.pink },
  less: { icon: 'LE', color: C.sapphire },
  vue: { icon: 'VU', color: C.green },
  svelte: { icon: 'SV', color: C.peach },

  // Config & Data
  json: { icon: '{}', color: C.yellow },
  yaml: { icon: 'YM', color: C.red },
  yml: { icon: 'YM', color: C.red },
  toml: { icon: 'TM', color: C.lavender },
  xml: { icon: '<>', color: C.peach },
  ini: { icon: 'IN', color: C.overlay1 },
  env: { icon: 'EN', color: C.yellow },

  // Shell & Scripts
  sh: { icon: 'SH', color: C.green },
  bash: { icon: 'SH', color: C.green },
  zsh: { icon: 'SH', color: C.green },
  fish: { icon: 'SH', color: C.green },
  bat: { icon: 'BT', color: C.lavender },
  ps1: { icon: 'PS', color: C.sapphire },
  cmd: { icon: 'CM', color: C.overlay1 },

  // Build & CI
  dockerfile: { icon: 'DK', color: C.sky },
  makefile: { icon: 'MK', color: C.peach },
  gradle: { icon: 'GR', color: C.green },
  cmake: { icon: 'CM', color: C.red },

  // Docs & Text
  md: { icon: 'MD', color: C.blue },
  mdx: { icon: 'MX', color: C.mauve },
  txt: { icon: 'TX', color: C.text },
  pdf: { icon: 'PD', color: C.red },
  doc: { icon: 'WO', color: C.sapphire },
  docx: { icon: 'WO', color: C.sapphire },

  // Images
  png: { icon: 'IM', color: C.flamingo },
  jpg: { icon: 'IM', color: C.flamingo },
  jpeg: { icon: 'IM', color: C.flamingo },
  gif: { icon: 'IM', color: C.flamingo },
  svg: { icon: 'VG', color: C.peach },
  webp: { icon: 'IM', color: C.flamingo },
  ico: { icon: 'IM', color: C.flamingo },

  // Database
  sql: { icon: 'SQ', color: C.blue },
  sqlite: { icon: 'DB', color: C.sky },
  prisma: { icon: 'PR', color: C.subtext1 },

  // Testing
  test: { icon: 'TE', color: C.green },
  spec: { icon: 'SP', color: C.green },
  test_ts: { icon: 'TE', color: C.green },
  test_js: { icon: 'TE', color: C.green },

  // Other
  lock: { icon: 'LK', color: C.overlay1 },
  gitignore: { icon: 'GI', color: C.peach },
  editorconfig: { icon: 'EC', color: C.yellow },
  license: { icon: 'LI', color: C.yellow },
  changelog: { icon: 'CL', color: C.blue },
}

const NAME_MAP: Record<string, FileIcon> = {
  dockerfile: { icon: 'DK', color: C.sky },
  makefile: { icon: 'MK', color: C.peach },
  gemfile: { icon: 'GM', color: C.red },
  podfile: { icon: 'PD', color: C.blue },
  procfile: { icon: 'PR', color: C.peach },
  vagrantfile: { icon: 'VG', color: C.blue },
  brewfile: { icon: 'BW', color: C.peach },
  'rakefile': { icon: 'RK', color: C.red },
  'justfile': { icon: 'JT', color: C.green },
  '.gitignore': { icon: 'GI', color: C.peach },
  '.env': { icon: 'EN', color: C.yellow },
  '.env.example': { icon: 'EN', color: C.yellow },
  '.editorconfig': { icon: 'EC', color: C.yellow },
  'license': { icon: 'LI', color: C.yellow },
  'readme.md': { icon: 'RD', color: C.blue },
  'changelog.md': { icon: 'CL', color: C.blue },
  'contributing.md': { icon: 'CT', color: C.green },
  'package.json': { icon: 'NP', color: C.green },
  'tsconfig.json': { icon: 'TS', color: C.blue },
  'vite.config.ts': { icon: 'VT', color: C.mauve },
  'vite.config.js': { icon: 'VT', color: C.mauve },
  'webpack.config.js': { icon: 'WP', color: C.sky },
  'eslint.config.js': { icon: 'ES', color: C.lavender },
  '.eslintrc.js': { icon: 'ES', color: C.lavender },
  'prettier.config.js': { icon: 'PR', color: C.pink },
  '.prettierrc': { icon: 'PR', color: C.pink },
  'jest.config.js': { icon: 'JT', color: C.green },
  'vitest.config.ts': { icon: 'VT', color: C.green },
}

export function getFileIcon(filename: string): FileIcon {
  const lower = filename.toLowerCase()

  // Check name-based matches first
  if (NAME_MAP[lower]) return NAME_MAP[lower]

  // Special: no extension
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex === -1) return { icon: '📄', color: C.text }

  const ext = lower.slice(dotIndex + 1)

  // Handle test/spec files
  if (lower.includes('.test.') || lower.includes('.spec.')) {
    return { icon: 'TE', color: C.green }
  }

  return EXT_MAP[ext] || { icon: ext.slice(0, 2).toUpperCase(), color: C.overlay1 }
}

export function getFileIconBg(filename: string): string {
  const icon = getFileIcon(filename)
  return `${icon.color}22`
}

export function getFileIconColor(filename: string): string {
  return getFileIcon(filename).color
}
