import Link from "next/link";
import { CONTACT } from "@/lib/contact";
import { getPlatformSettings } from "@/lib/platform-settings";
import { Brand } from "./brand";

export async function Footer() {
  const { facebookUrl, youtubeUrl } = await getPlatformSettings();
  const hasSocial = Boolean(facebookUrl || youtubeUrl);

  return (
    <footer className="border-t border-white/[0.06] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {/* Брэнд + сошиал */}
        <div className="flex flex-col gap-3">
          <Link href="/">
            <Brand size="sm" />
          </Link>
          <p className="text-xs text-white/40 max-w-xs">
            {CONTACT.org} — авто үйлчилгээний ухаалаг платформ.
          </p>
          {hasSocial ? (
            <div className="flex items-center gap-2 mt-1">
              {facebookUrl ? (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <FacebookIcon />
                </a>
              ) : null}
              {youtubeUrl ? (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <YoutubeIcon />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Холбоос */}
        <nav className="flex flex-col gap-2 text-sm text-white/50">
          <span className="text-white/30 text-xs uppercase tracking-wider mb-1">
            Холбоос
          </span>
          <a
            href="/page/landing#features"
            className="hover:text-white/80 transition-colors"
          >
            Боломжууд
          </a>
          <a
            href="/page/landing#pricing"
            className="hover:text-white/80 transition-colors"
          >
            Үнэ
          </a>
          <Link href="/terms" className="hover:text-white/80 transition-colors">
            Үйлчилгээний нөхцөл
          </Link>
          <Link href="/privacy" className="hover:text-white/80 transition-colors">
            Нууцлалын бодлого
          </Link>
          <Link href="/contact" className="hover:text-white/80 transition-colors">
            Холбоо барих
          </Link>
        </nav>

        {/* Холбоо барих */}
        <div className="flex flex-col gap-1.5 text-sm text-white/50">
          <span className="text-white/30 text-xs uppercase tracking-wider mb-1">
            Холбоо барих
          </span>
          <div className="text-white/75 font-medium">{CONTACT.org}</div>
          <a
            href={`mailto:${CONTACT.email}`}
            className="hover:text-white/80 transition-colors"
          >
            {CONTACT.email}
          </a>
          <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            {CONTACT.phones.map((p) => (
              <a
                key={p}
                href={`tel:${p}`}
                className="hover:text-white/80 transition-colors"
              >
                {p}
              </a>
            ))}
          </div>
          <div className="text-white/40 text-xs mt-0.5">{CONTACT.address}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/[0.04] text-xs text-white/25">
        {CONTACT.copyright}
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}
