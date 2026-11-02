import { AdminProvider } from "@/lib/admin/store";
import { JourneyProvider } from "@/lib/journey/store";

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <JourneyProvider>
      <AdminProvider>{children}</AdminProvider>
    </JourneyProvider>
  );
}
