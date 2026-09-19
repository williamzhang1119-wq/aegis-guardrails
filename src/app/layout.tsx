import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venture 1 — an AI assistant with visible safety guardrails",
  description:
    "A chat assistant wrapped in a deterministic guardrail pipeline: input classification, PII and secret redaction, prompt-injection quarantine, output filtering, and an audit trail you can inspect on every turn.",
};

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <ShieldCheck className="size-4" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">Venture 1</span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              guarded assistant
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Chat
          </Link>
          <Link
            href="/safety"
            className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Safety policy
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider delayDuration={200}>
          <SiteHeader />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
