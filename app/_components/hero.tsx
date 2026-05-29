import Link from "next/link";

export function Hero() {
  return (
    <section className="relative pt-24 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden hero-glow">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          100+ сервис төв carcare дээр ажиллаж байна
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
          Сервисээ{" "}
          <span className="gradient-text">ухаалгаар</span>
          <br />
          удирдаарай
        </h1>

        <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          carcare нь олон салбартай оношилгоо, засвар үйлчилгээний
          байгууллагуудад зориулсан PaaS платформ. Захиалга, машины түүх, нөөц,
          тайлан — нэг л дэлгэц дээр.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/page/signup"
            className="glow-btn w-full sm:w-auto bg-violet-600 hover:bg-violet-500 transition-all px-8 py-3.5 rounded-xl font-semibold text-base"
          >
            Үнэгүй эхлүүлэх →
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto glass hover:bg-white/[0.08] transition-all px-8 py-3.5 rounded-xl font-semibold text-base text-white/80"
          >
            Дэлгэрэнгүй
          </a>
        </div>

        <div className="mt-16 relative float-anim">
          <div className="glass rounded-2xl p-6 max-w-sm mx-auto border border-violet-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-bold text-sm">
                TP
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Toyota Prius 30</div>
                <div className="text-xs text-white/40">Тосны солилт</div>
              </div>
              <div className="ml-auto text-green-400 text-sm font-medium">
                ✓ Дууссан
              </div>
            </div>
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span>Ажлын явц</span>
              <span>Хүлээгдэж буй → Дууссан</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
