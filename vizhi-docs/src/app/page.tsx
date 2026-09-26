import { redirect } from "next/navigation";

/** The docs site has no marketing landing page — the reference is the product. */
export default function Home() {
  redirect("/docs");
}
