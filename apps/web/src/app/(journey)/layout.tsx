import { AdminProvider } from "@/lib/admin/store";
import { AuthProvider } from "@/lib/auth/store";
import { JourneyProvider } from "@/lib/journey/store";
import { WorkspaceProvider } from "@/lib/workspace/store";

// Every page shares the accounts, workplaces, Studio library and workspace records, so landing
// pages and dashboards can read across workplaces.
export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <JourneyProvider>
        <AdminProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AdminProvider>
      </JourneyProvider>
    </AuthProvider>
  );
}
