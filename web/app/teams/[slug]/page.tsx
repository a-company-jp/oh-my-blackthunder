import type { Metadata } from "next";

import { TeamPageView } from "@/app/teams/[slug]/TeamPageView";

// Next 15: route params are async — resolve the Promise before reading `slug`.
type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeURIComponent(slug);
  return {
    title: `${name} のチームページ ⚡ | Black Thunder`,
    description: `${name} チームの合計AIザクザク度とメンバーランキング。`,
  };
}

export default async function TeamSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  return <TeamPageView slug={decodeURIComponent(slug)} />;
}
