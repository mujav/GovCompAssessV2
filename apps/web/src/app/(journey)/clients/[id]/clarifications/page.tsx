import { redirect } from "next/navigation";

// Clarifications live on their requirements; this lists every requirement a question touches.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clients/${id}/requirements?view=cla`);
}
