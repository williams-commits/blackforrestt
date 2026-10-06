import { GlobalFXLogo } from "@/components/branding/GlobalFXLogo";

export function GbfxsMark({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return <GlobalFXLogo className={className} size={size === "lg" ? "lg" : "md"} inverted />;
}
