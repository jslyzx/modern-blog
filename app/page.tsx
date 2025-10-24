import katex from "katex";
import Link from "next/link";

import { UiPreview } from "@/components/examples/ui-preview";

const equationHtml = katex.renderToString("\\int_0^{\\infty} e^{-x^2} \\; dx = \\frac{\\sqrt{\\pi}}{2}", {
  displayMode: true,
});

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 lg:py-24">
      <section className="flex flex-col gap-5 text-center lg:text-left">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:mx-0">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Next.js 15 · React 19 · Tailwind · shadcn UI
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Build your content-first blog in minutes.
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground lg:mx-0">
          This starter kit wires together Next.js 15, Tailwind CSS, shadcn UI, and KaTeX so you can focus on writing great posts, not plumbing your design system.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
          <Link href="/docs/getting-started" className="sm:w-auto">
            <span className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90">
              Read the guide
            </span>
          </Link>
          <a
            href="https://ui.shadcn.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          >
            Browse components
          </a>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <UiPreview className="order-2 lg:order-1" />
        <div className="order-1 flex flex-col gap-6 rounded-lg border bg-muted/30 p-6 text-sm leading-relaxed lg:order-2">
          <div>
            <h2 className="text-lg font-semibold">KaTeX ready out of the box</h2>
            <p className="mt-2 text-muted-foreground">
              Write math-heavy articles with confidence. KaTeX styles are loaded globally, so every formula renders crisply for your readers.
            </p>
          </div>
          <div className="rounded-lg border bg-card/50 p-4 text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wide">Sample equation</span>
            <div className="mt-2 overflow-x-auto pb-2" dangerouslySetInnerHTML={{ __html: equationHtml }} />
          </div>
          <ul className="grid gap-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary/80" />
              <span>
                Tailwind CSS 3 with sensible defaults, dark mode tokens, and utility-first styling.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary/80" />
              <span>
                shadcn UI primitives to kickstart dialogs, inputs, and buttons across the app.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary/80" />
              <span>
                Strict ESLint + Prettier setup keeps your codebase consistent from the first commit.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
