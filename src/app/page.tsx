import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Markets, PlatformFeatures, Education, Support } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero mockup) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/** Public landing page for Black Forest Digital. */
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Markets />
        <PlatformFeatures />
        <Education />
        <Support />
      </main>
      <Footer />
    </>
  );
}
