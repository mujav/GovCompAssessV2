import { WorkspaceProvider } from "@/lib/workspace/store";

// A client workspace runs on the same records the entity sees in its own workspace.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
