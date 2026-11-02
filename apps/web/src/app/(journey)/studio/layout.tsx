import { ConsultantShell } from "@/components/journey/shell";
import { ActingAs, StudioNav } from "@/components/journey/studio";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsultantShell search="Search frameworks, rules and changes" headerExtra={<ActingAs />}>
      <StudioNav />
      {children}
    </ConsultantShell>
  );
}
