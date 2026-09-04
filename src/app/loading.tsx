import { PageLoading } from "@/components/PageLoading";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows delayed character feedback while an App Router page is loading.
 */
export default function Loading() {
  return <PageLoading scene="map" text="展开地图，准备出发…" />;
}
