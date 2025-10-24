# Next.js Blog Starter

A batteries-included blog foundation powered by **Next.js 15**, **React 19**, **Tailwind CSS**, **shadcn UI**, and **KaTeX**. It ships with opinionated linting and formatting so you can focus on creating content instead of wiring up tooling.

## Features

- ⚡️ Next.js 15 App Router with React 19 support.
- 🎨 Tailwind CSS 3 configured with CSS variable driven design tokens.
- 🧩 Pre-built shadcn UI primitives (Button, Input, Dialog) and CLI configured via `components.json`.
- 🧮 KaTeX stylesheet loaded globally for math-friendly posts.
- ✅ ESLint + Prettier, with an optional Husky pre-commit hook running `pnpm lint`.

## Prerequisites

- Node.js 18.18+ or 20+ (Corepack recommended).
- [pnpm](https://pnpm.io/) (`corepack enable pnpm`).

## Getting Started

Install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the landing page showcasing Tailwind styling, shadcn components, and a KaTeX example.

## Useful Scripts

```bash
pnpm dev        # Start the Next.js development server
pnpm build      # Create a production build
pnpm start      # Start the production server
pnpm lint       # Run ESLint using the Next.js configuration
pnpm typecheck  # Validate TypeScript types
pnpm format     # Check formatting with Prettier
pnpm format:fix # Format files with Prettier
pnpm shadcn     # Access the shadcn UI CLI
```

## Adding New Components

Use the shadcn CLI to scaffold additional UI primitives:

```bash
pnpm shadcn add alert-dialog
```

Generated components will follow the aliases defined in `components.json` and work out of the box with the existing Tailwind configuration.
