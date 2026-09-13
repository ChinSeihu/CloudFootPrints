import { PageLoading } from "@/components/PageLoading";

/**
 * Signature: `function Loading(): React.JSX.Element`
 * Purpose: Shows a calendar-turning IP while the calendar route resolves.
 */
export default function Loading() {
  return <PageLoading scene="calendar" messageKey="loading.calendar" />;
}
