import Link from "next/link";

export function CtaBanner() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-10 sm:p-16 text-center border border-violet-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-blue-600/5 pointer-events-none" />
          <div className="relative">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Сервисээ дараагийн түвшинд гарга
            </h2>
            <p className="text-white/50 mb-10 leading-relaxed max-w-lg mx-auto">
              14 хоног үнэгүй туршиж үзээрэй. Карт хэрэггүй, ямар ч үед цуцалж болно.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/page/signup"
                className="glow-btn bg-violet-600 hover:bg-violet-500 transition-all px-8 py-3.5 rounded-xl font-semibold"
              >
                Үнэгүй эхлүүлэх
              </Link>
              <a
                href="mailto:hi@carcare.mn"
                className="glass hover:bg-white/[0.08] transition-all px-8 py-3.5 rounded-xl font-semibold text-white/70"
              >
                Борлуулалттай ярих
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
