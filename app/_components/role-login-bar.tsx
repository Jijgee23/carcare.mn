import Link from "next/link";
import { CarIcon, WrenchIcon } from "./landing-icons";

/* Landing-ийн хамгийн эхэнд байрлах, хоёр төрлийн хэрэглэгчийг (ажилтан/
   үйлчлүүлэгч) зөв нэвтрэх хуудас руу нь чиглүүлэх нарийхан мөр. */
export function RoleLoginBar() {
  return (
    <div className="relative border-b border-white/[0.06] bg-black/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 sm:gap-x-3 text-xs sm:text-sm text-white/60">
        <Link
          href="/page/login"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full hover:bg-white/[0.06] hover:text-white transition-colors [&>svg]:w-3.5 [&>svg]:h-3.5"
        >
          <WrenchIcon />
          <span className="sm:hidden">Ажилтан</span>
          <span className="hidden sm:inline">Засварын газрын ажилтан</span>
        </Link>
        <span className="text-white/15">|</span>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full hover:bg-white/[0.06] hover:text-white transition-colors [&>svg]:w-3.5 [&>svg]:h-3.5"
        >
          <CarIcon />
          <span className="sm:hidden">Хэрэглэгч</span>
          <span className="hidden sm:inline">Хэрэглэгчээр нэвтрэх</span>
        </Link>
      </div>
    </div>
  );
}
