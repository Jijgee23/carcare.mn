import TopBar from "@/components/TopBar";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Audiences from "@/components/Audiences";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import Faq from "@/components/Faq";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <main className="bg-carbon">
      <TopBar />
      <Nav />
      <Hero />
      <Stats />
      <Audiences />
      <Features />
      <HowItWorks />
      <Pricing />
      <Faq />
      <Cta />
      <Footer />
    </main>
  );
}
