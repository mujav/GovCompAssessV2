import { AppShell } from "@/components/journey/shell";
import { ActingAs, StudioNav } from "@/components/journey/studio";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell search="Search standards, rules and changes" headerExtra={<ActingAs />}>
      <StudioNav />
      {children}
    </AppShell>
  );
}
