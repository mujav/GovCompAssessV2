import { redirect } from "next/navigation";

// The engagement now lives on the entity profile.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clients/${id}/360?tab=engagement`);
}
