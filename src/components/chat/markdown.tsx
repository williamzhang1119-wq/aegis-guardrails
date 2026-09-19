import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Assistant copy is written in markdown (refusals include help lines and
 * links), so it needs real rendering rather than a whitespace-preserving div.
 */
export function MarkdownBody({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="[&:not(:first-child)]:mt-3">{children}</p>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs">
              {children}
            </pre>
          ),
          h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
