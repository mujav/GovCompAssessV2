"use client";

import { ALL, useEntityFrameworks } from "@/lib/journey/use-work";
import { Segmented } from "./ui";

/**
 * Which of the entity's frameworks the client pages show. One choice per entity: switching
 * here also switches requirements, work and evidence. Hidden when there is only one.
 */
export function FrameworkSwitcher({ allowAll = false }: { allowAll?: boolean }) {
  const { frameworks, active, current, setActive } = useEntityFrameworks();
  if (frameworks.length < 2) return null;
  const value = allowAll ? active : (current?.id ?? "");
  const options = [...(allowAll ? [{ value: ALL, label: "All standards" }] : []), ...frameworks.map((f) => ({ value: f.id, label: f.short }))];
  return <Segmented label="Framework" value={value} options={options} onChange={setActive} />;
}
