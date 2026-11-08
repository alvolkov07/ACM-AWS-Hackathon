import Link from "next/link";

export default function Hero() {
  return (
    <section
      id="top"
      className="on-photo relative z-10 flex w-full flex-1 flex-col justify-end px-6 pb-14 pt-24 md:px-12 md:pb-20 lg:px-16 lg:pb-24"
    >
      <div className="flex w-full flex-col gap-10 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="min-w-0 max-w-xl shrink md:max-w-2xl lg:max-w-3xl">
          <span
            className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-[rgba(24,38,18,0.38)] px-4 py-1.5 backdrop-blur-sm font-display text-[15px] text-white opacity-0"
            style={{ animationDelay: "60ms" }}
          >
            <span aria-hidden className="sprig h-4 w-4" />
            Made for growers
          </span>
          <p
            className="animate-fade-up mt-5 font-display text-[clamp(4rem,11vw,9rem)] leading-[0.85] tracking-[-0.02em] text-white opacity-0"
            style={{ animationDelay: "140ms" }}
          >
            eagle
          </p>
          <h1
            className="animate-fade-up mt-5 max-w-xl font-display text-[clamp(1.5rem,2.8vw,2.25rem)] leading-snug text-white opacity-0"
            style={{ animationDelay: "280ms" }}
          >
            {/* Non-breaking hyphens keep "back-and-forth" on one line. */}
            Farm supplies, sourced without the back&#8209;and&#8209;forth.
          </h1>
        </div>

        <div className="flex w-full min-w-0 flex-col items-start md:ml-auto md:w-auto md:max-w-md md:items-end">
          <p
            className="animate-fade-up w-full max-w-md text-[15px] leading-relaxed text-white opacity-0 md:text-right md:text-[16px]"
            style={{ animationDelay: "400ms" }}
          >
            Tell Eagle what your farm needs. It finds trusted suppliers in your state, drafts the
            quote requests for you to approve, and helps you compare every reply.
          </p>

          <div
            className="animate-fade-up mt-7 flex flex-wrap items-center gap-3 opacity-0 md:mt-8 md:justify-end"
            style={{ animationDelay: "520ms" }}
          >
            <Link href="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-solid btn-white">
              Sign up free
              <span aria-hidden className="sprig btn__sprig" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
