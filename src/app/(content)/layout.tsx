import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

/**
 * Shared layout for the marketing content pages (About, Tools, Analytics,
 * Education, Legal). Mirrors the landing navbar + footer so every public page
 * feels cohesive.
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
