import { CtaBanner } from "../../_components/cta-banner";
import { Faq } from "../../_components/faq";
import { Features } from "../../_components/features";
import { Footer } from "../../_components/footer";
import { Hero } from "../../_components/hero";
import { HowItWorks } from "../../_components/how-it-works";
import { Nav } from "../../_components/nav";
import { Personas } from "../../_components/personas";
import { Pricing } from "../../_components/pricing";
import { Stats } from "../../_components/stats";

export const metadata = {
  title: "Танилцуулга — Авто үйлчилгээний ухаалаг платформ",
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <Personas />
        <Pricing />
        <Faq />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
