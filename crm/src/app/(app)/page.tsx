import { DashboardCards } from "@/components/DashboardCards";
import { HomeWidgets } from "@/components/HomeWidgets";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <DashboardCards />
      <HomeWidgets />
    </div>
  );
}
