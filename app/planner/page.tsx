import { redirect } from "next/navigation";

// The planner now lives on Hari ini (/). Keep old links working.
export default function PlannerPage() {
  redirect("/");
}
