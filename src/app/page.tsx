import { ChatWorkbench } from "@/components/chat/chat-workbench";

export default function HomePage() {
  return (
    // A definite height is what lets the message pane own its own scrollbar and
    // keeps the composer pinned. Without it the flex children fall back to
    // content height, the page scrolls instead, and the composer drifts away.
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <ChatWorkbench />
    </div>
  );
}
