import { PageLoading } from "@/components/PageLoading";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows the same album action used by personal authentication and content loading.
 */
export default function Loading() {
  return <PageLoading scene="profile" text="整理相册，找回你的城市回忆…" />;
}
