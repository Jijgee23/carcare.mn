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

// Үнэ (PlanPrice/PlanFeature) backend-аас ирдэг тул цаг тутам сэргээнэ (ISR).
export const revalidate = 3600;

export default function LandingPage() {
  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Background wallpaper — blur-тэй, унших боломжтой байлгахын тулд бараан давхаргатай */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center"
          style={{ backgroundImage: "url('/wallpaper.jpg')" }}
        />
        <div className="absolute inset-0 bg-[#0a0a0f]/85" />
      </div>
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
