import type { Metadata } from "next";

import { ProfileView } from "@/app/u/[login]/ProfileView";

// Next 15: route params are async — resolve the Promise before reading `login`.
type Params = Promise<{ login: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { login } = await params;
  const handle = decodeURIComponent(login);
  return {
    title: `@${handle} のAIザクザク度 ⚡ | ブラッカソン`,
    description: `@${handle} のAIザクザク度とブラックサンダーカウント。`,
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { login } = await params;
  return <ProfileView login={decodeURIComponent(login)} />;
}
