import { redirect } from "next/navigation";

// Volume discount scheme removed. Redirect to catalog.
export default function DiscountPage() {
  redirect("/catalog");
}
