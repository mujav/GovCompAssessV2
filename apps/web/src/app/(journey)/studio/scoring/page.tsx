import { redirect } from "next/navigation";

// Scoring was removed: government indices do not publish their weights, so the platform tracks
// requirements met instead of computing a score. Old links land on the Standard library.
export default function ScoringPage() {
  redirect("/studio/frameworks");
}
