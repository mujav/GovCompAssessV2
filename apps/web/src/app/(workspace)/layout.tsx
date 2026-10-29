import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceProvider } from "@/lib/workspace/store";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
