import { redirect } from "next/navigation";

// The entity picker is the portfolio's card view.
export default function EntitiesPage() {
  redirect("/portfolio?view=cards");
}
