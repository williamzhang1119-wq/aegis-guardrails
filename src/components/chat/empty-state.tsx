import { Eye, ShieldCheck, SlidersHorizontal } from "lucide-react";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Two passes, one taxonomy",
    body: "Your message is checked before the model sees it, and the model's draft is checked before you see it — against the same 19 categories.",
  },
  {
    icon: Eye,
    title: "Every decision is shown",
    body: "Open the panel under any message for the checks that ran, what each scored, which patterns matched, and how long it took.",
  },
  {
    icon: SlidersHorizontal,
    title: "The dials are real",
    body: "Turn a defence off in Controls and send the same probe again. Three categories are locked and the server enforces that.",
  },
];

export function EmptyState() {
  return (
    <div className="mx-auto max-w-xl py-6 text-center sm:py-10">
      <div
        aria-hidden
        className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-card"
      >
        <ShieldCheck className="size-5 text-muted-foreground" />
      </div>

      <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
        An assistant you can watch being safe
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Most safety layers are invisible — you only ever see the refusal. This one shows its work on
        every single turn, including the turns where it decides to let you through.
      </p>

      <ul className="mt-7 grid gap-3 text-left sm:grid-cols-3">
        {POINTS.map((point) => (
          <li key={point.title} className="rounded-xl border bg-card/60 p-3">
            <point.icon className="size-4 text-muted-foreground" aria-hidden />
            <h3 className="mt-2 text-xs font-semibold">{point.title}</h3>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{point.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        Start with a red-team probe below, or just ask something ordinary and watch it pass.
      </p>
    </div>
  );
}
