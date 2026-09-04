import { NavigationFeedback } from "@/components/Mascot/MascotFeedback";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows delayed character feedback while an App Router page is loading.
 */
export default function Loading() {
  return <NavigationFeedback />;
}
