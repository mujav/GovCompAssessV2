import { redirect } from "next/navigation";

// Framework comparison is the overview's All frameworks view; year-on-year history is on the entity profile.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clients/${id}`);
}
