import { BrowsePage } from "@/components/common/BrowsePage";
/**
 * Signature: `function RecommendPage(): React.JSX.Element`
 * Purpose: Opens a persistent browsing shell without blocking navigation on database reads.
 */
export default function RecommendPage() {
  return <BrowsePage mode="recommend" />;
}
