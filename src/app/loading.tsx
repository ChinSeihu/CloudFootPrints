import { PageLoading } from "@/components/PageLoading";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows the minimal Cloud Footprints brand mark while the initial App Router page is loading.
 */
export default function Loading() {
  return <PageLoading variant="splash" text="正在展开东京…" />;
}
