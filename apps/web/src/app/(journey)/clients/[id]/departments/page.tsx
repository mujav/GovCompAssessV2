import { redirect } from "next/navigation";

// Department progress now lives on the overview.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clients/${id}`);
}
