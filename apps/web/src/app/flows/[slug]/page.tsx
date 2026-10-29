import { notFound } from "next/navigation";
import { FLOWS, getFlow, readFlowHtml } from "@/lib/flows";

export function generateStaticParams() {
  return FLOWS.map((f) => ({ slug: f.slug }));
}

export default async function FlowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const flow = getFlow(slug);
  if (!flow) notFound();

  return (
    <main className="flex flex-col gap-3 px-8 pb-12 pt-6">
      <h2 className="m-0 text-lg font-semibold">
        <span className="mr-2 font-mono text-muted">{flow.code}</span>
        {flow.title}
      </h2>
      {/* Boards are fixed-size artboards; scroll horizontally on narrow screens. */}
      <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
        <div style={{ width: flow.width }} dangerouslySetInnerHTML={{ __html: readFlowHtml(flow.slug) }} />
      </div>
    </main>
  );
}
