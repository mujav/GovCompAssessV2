import { redirect } from "next/navigation";

// The Studio entry opens its first section.
export default function StudioPage() {
  redirect("/studio/frameworks");
}
