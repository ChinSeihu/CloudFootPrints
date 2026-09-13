import { PageLoading } from "@/components/PageLoading";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows the IP searching for discoveries while the feed route resolves.
 */
export default function Loading() {
  return <PageLoading scene="discover" messageKey="loading.discover" />;
}
