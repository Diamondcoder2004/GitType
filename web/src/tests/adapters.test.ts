import { describe, it, expect, beforeEach } from 'vitest'
import { languageRegistry } from '../core/ast/languageAdapter'
import '../core/ast/markdown.adapter'
import '../core/ast/yaml.adapter'
import '../core/ast/dockerfile.adapter'
import '../core/ast/vue.adapter'
import '../core/ast/universal.adapter'
import { extractCodeBlocks } from '../core/ast/blockExtractor'

describe('Markdown Adapter', () => {
  it('должен извлекать code blocks из markdown', () => {
    const md = `# Заголовок

Текст описания.

\`\`\`typescript
function hello() {
  console.log("Hello")
}
\`\`\`

Ещё текст.

\`\`\`python
def greet(name):
    return f"Hello {name}"
\`\`\`
`
    const blocks = extractCodeBlocks(md, 'README.md')
    expect(blocks.length).toBe(2)
    expect(blocks[0].name).toBe('typescript snippet')
    expect(blocks[0].code).toContain('function hello()')
    expect(blocks[1].name).toBe('python snippet')
    expect(blocks[1].code).toContain('def greet(name)')
  })

  it('должен игнорировать пустые code blocks', () => {
    const md = `# Title

\`\`\`
\`\`\`

\`\`\`js
const x = 1
\`\`\`
`
    const blocks = extractCodeBlocks(md, 'test.md')
    expect(blocks.length).toBe(1)
  })

  it('должен работать с mdx', () => {
    const mdx = `# Page

\`\`\`tsx
export default function Page() {
  return <div>Hello</div>
}
\`\`\`
`
    const blocks = extractCodeBlocks(mdx, 'page.mdx')
    expect(blocks.length).toBe(1)
    expect(blocks[0].code).toContain('export default function')
  })
})

describe('YAML Adapter', () => {
  it('должен извлекать секции из YAML', () => {
    const yaml = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy@v1
`
    const blocks = extractCodeBlocks(yaml, '.github/workflows/ci.yml')
    // name: CI — 1 строка, фильтруется YAML адаптером (>= 2)
    // on: — 5 строк, проходит
    // jobs: — 8 строк, проходит
    expect(blocks.length).toBe(2)
    expect(blocks[0].name).toBe('on')
    expect(blocks[1].name).toBe('jobs')
  })

  it('должен работать с JSON', () => {
    const json = `{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "react": "^18.0.0"
  }
}
`
    const blocks = extractCodeBlocks(json, 'package.json')
    // JSON — один блок верхнего уровня
    expect(blocks.length).toBeGreaterThanOrEqual(1)
  })

  it('должен работать с TOML', () => {
    const toml = `[package]
name = "my-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
criterion = "0.4"
`
    const blocks = extractCodeBlocks(toml, 'Cargo.toml')
    // Пустые строки добавляются к предыдущему блоку, увеличивая его до >= 2 строк
    // version, tokio, [dev-dependencies] — проходят (по 2 строки с пустой строкой)
    expect(blocks.length).toBe(3)
  })
})

describe('Dockerfile Adapter', () => {
  it('должен извлекать инструкции из Dockerfile', () => {
    const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
`
    const blocks = extractCodeBlocks(dockerfile, 'Dockerfile')
    // Каждая инструкция + пустая строка = 2 строки, проходят фильтр
    expect(blocks.length).toBe(7)
    expect(blocks[0].name).toContain('Base:')
    expect(blocks.some(b => b.name === 'RUN')).toBe(true)
  })

  it('должен работать с Dockerfile.dev', () => {
    const dockerfile = `FROM node:18

RUN npm install -g nodemon

COPY . .

CMD ["nodemon", "index.js"]
`
    const blocks = extractCodeBlocks(dockerfile, 'Dockerfile.dev')
    // Каждая инструкция + пустая строка = 2 строки, проходят
    expect(blocks.length).toBe(4)
  })

  it('должен обрабатывать многострочные RUN', () => {
    const dockerfile = `FROM ubuntu:22.04

RUN apt-get update && \\
    apt-get install -y \\
    python3 \\
    python3-pip \\
    && rm -rf /var/lib/apt/lists/*

CMD ["python3"]
`
    const blocks = extractCodeBlocks(dockerfile, 'Dockerfile')
    // FROM (2 строки с пустой) — проходит
    // RUN (6 строк с продолжением) — проходит
    // CMD (2 строки с пустой) — проходит
    expect(blocks.length).toBe(3)
    // RUN блок должен содержать все строки продолжения
    const runBlock = blocks.find(b => b.name === 'RUN')
    expect(runBlock).toBeDefined()
    expect(runBlock!.code).toContain('apt-get update')
    expect(runBlock!.code).toContain('python3-pip')
  })
})

describe('Vue Adapter', () => {
  it('должен извлекать template, script, style из Vue SFC', () => {
    const vue = `<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const title = ref('Hello Vue')
const count = ref(0)
</script>

<style scoped>
.app {
  text-align: center;
  padding: 2rem;
}
</style>
`
    const blocks = extractCodeBlocks(vue, 'App.vue')
    expect(blocks.length).toBe(3)
    expect(blocks[0].name).toBe('<template>')
    expect(blocks[1].name).toBe('<script lang="ts">')
    expect(blocks[2].name).toBe('<style>')
  })

  it('должен работать с Svelte', () => {
    const svelte = `<script>
  let name = 'world'
</script>

<main>
  <h1>Hello {name}!</h1>
</main>

<style>
  h1 {
    color: purple;
  }
</style>
`
    const blocks = extractCodeBlocks(svelte, 'App.svelte')
    expect(blocks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Universal Adapter - HTML', () => {
  it('должен извлекать блоки по тегам', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test</title>
</head>
<body>
  <div class="container">
    <h1>Hello</h1>
    <p>World</p>
  </div>
</body>
</html>
`
    const blocks = extractCodeBlocks(html, 'index.html')
    expect(blocks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Universal Adapter - CSS', () => {
  it('должен извлекать CSS правила', () => {
    const css = `.container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.button {
  background: blue;
  color: white;
  padding: 1rem 2rem;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
}
`
    const blocks = extractCodeBlocks(css, 'styles.css')
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks[0].name).toBe('.container')
    expect(blocks[1].name).toBe('.button')
  })
})

describe('Universal Adapter - SQL', () => {
  it('должен извлекать SQL запросы', () => {
    const sql = `-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE
);

-- Insert sample data
INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com');

-- Select active users
SELECT name, email
FROM users
WHERE created_at > '2024-01-01'
ORDER BY name;
`
    const blocks = extractCodeBlocks(sql, 'schema.sql')
    expect(blocks.length).toBeGreaterThanOrEqual(3)
    expect(blocks[0].name).toContain('CREATE')
    expect(blocks[1].name).toContain('INSERT')
    expect(blocks[2].name).toContain('SELECT')
  })
})

describe('Universal Adapter - Shell', () => {
  it('должен извлекать shell функции', () => {
    const sh = `#!/bin/bash

greet() {
  echo "Hello, $1!"
}

deploy() {
  echo "Deploying..."
  npm run build
  scp -r dist/ server:/var/www/
  echo "Done!"
}

greet "World"
deploy
`
    const blocks = extractCodeBlocks(sh, 'deploy.sh')
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks[0].name).toBe('greet')
    expect(blocks[1].name).toBe('deploy')
  })
})

describe('Universal Adapter - Fallback', () => {
  it('должен извлекать блоки по отступам для неизвестных форматов', () => {
    const content = `# Section One
key1: value1
key2: value2
key3: value3

# Section Two
another: data
more: stuff
final: value
`
    const blocks = extractCodeBlocks(content, 'config.ini')
    expect(blocks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Language Adapter Registry - File Matchers', () => {
  it('должен находить адаптер для Dockerfile без расширения', () => {
    const adapter = languageRegistry.getAdapter('', 'Dockerfile')
    expect(adapter).not.toBeNull()
    expect(adapter!.extensions).toContain('dockerfile')
  })

  it('должен находить адаптер для containerfile', () => {
    const adapter = languageRegistry.getAdapter('', 'Containerfile')
    expect(adapter).not.toBeNull()
  })

  it('должен находить адаптер по расширению .vue', () => {
    const adapter = languageRegistry.getAdapter('vue', 'App.vue')
    expect(adapter).not.toBeNull()
  })

  it('должен находить адаптер по расширению .md', () => {
    const adapter = languageRegistry.getAdapter('md', 'README.md')
    expect(adapter).not.toBeNull()
  })
})
