import { JourneyProvider } from "@/lib/journey/store";

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  return <JourneyProvider>{children}</JourneyProvider>;
}
