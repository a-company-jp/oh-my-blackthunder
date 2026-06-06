import type { Metadata } from "next";

import { SecretView } from "@/app/secret/SecretView";

export const metadata: Metadata = {
  title: "⚡ ひみつのザクザク部屋",
  // Keep it out of search results — it is meant to be discovered, not indexed.
  robots: { index: false, follow: false },
};

export default function SecretPage() {
  return <SecretView />;
}
