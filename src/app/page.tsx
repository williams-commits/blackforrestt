import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Markets, PlatformFeatures, Education, Support } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

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
