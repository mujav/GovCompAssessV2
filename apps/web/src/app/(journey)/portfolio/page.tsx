import { redirect } from "next/navigation";

// The portfolio became the workplaces landing page.
export default function PortfolioPage() {
  redirect("/workplaces");
}
