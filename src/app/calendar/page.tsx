import { BrowsePage } from "@/components/common/BrowsePage";
/**
 * Signature: `function CalendarPage(): React.JSX.Element`
 * Purpose: Opens a persistent browsing shell without blocking navigation on database reads.
 */
export default function CalendarPage() {
  return <BrowsePage mode="calendar" />;
}
