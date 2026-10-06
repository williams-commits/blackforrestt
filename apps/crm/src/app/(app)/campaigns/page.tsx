import { RecordListPage } from "@/components/RecordListPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaigns" };

/** Campaigns run on the shared object-home table (same engine as leads). */
export default function CampaignsRoutePage() {
  return <RecordListPage object="campaigns" />;
}
