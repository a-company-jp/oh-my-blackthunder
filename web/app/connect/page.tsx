import { Suspense } from "react";

import { ConnectView } from "@/app/connect/ConnectView";
import { Loading } from "@/app/components/StateViews";

// useSearchParams requires a Suspense boundary in the App Router.
export default function ConnectPage() {
  return (
    <Suspense fallback={<Loading label="連携の準備中…" />}>
      <ConnectView />
    </Suspense>
  );
}
