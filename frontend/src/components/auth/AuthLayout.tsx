import Image from "next/image";
import Link from "next/link";
import HeroBackground from "@/components/HeroBackground";

type Props = {
  /** Headline on the photo panel. */
  headline: string;
  /** Short line under the headline. */
  blurb: string;
  children: React.ReactNode;
};

const FEATURES = [
  "Trusted suppliers in your state, ranked by reviews",
  "Quote requests drafted for you to approve",
  "Every reply compared, with a clear recommendation",
];

/** Two-panel layout for login, signup and farm setup: photo on the left, form on the right. */
export default function AuthLayout({ headline, blurb, children }: Props) {
  return (
    <main className="grid min-h-svh gap-3 bg-surface p-3 md:gap-4 md:p-4 lg:grid-cols-[1.05fr_1fr]">
      <section className="on-photo relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[28px] p-6 text-white md:rounded-[36px] md:p-10 lg:p-12">
        <HeroBackground tint={0.28} sizes="(min-width: 1024px) 55vw, 100vw" />
        <Link href="/" aria-label="Eagle home" className="relative z-10 w-fit transition-opacity hover:opacity-85">
          <Image
            src="/brand/eagle_banner_white.png"
            alt="Eagle"
            width={135}
            height={40}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>

        <div className="relative z-10 mt-10">
          <h1 className="max-w-lg font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">{headline}</h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed md:text-[16px]">{blurb}</p>
          <ul className="mt-8 hidden flex-col gap-3 lg:flex">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px]">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[rgba(24,38,18,0.38)] backdrop-blur-sm">
                  <span aria-hidden className="sprig h-4 w-4" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center px-3 py-10 md:px-10">
        <div className="fade-in w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
