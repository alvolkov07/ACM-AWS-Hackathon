import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 pt-6 md:px-12 md:pt-8 lg:px-16">
      <Link href="/" className="transition-opacity duration-300 hover:opacity-85" aria-label="Eagle home">
        <Image
          src="/brand/eagle_banner_white.png"
          alt="Eagle"
          // Display size (40px tall at md); the file is 1049x311.
          width={135}
          height={40}
          priority
          className="h-8 w-auto md:h-10"
        />
      </Link>

      <nav className="on-photo flex items-center gap-2 md:gap-4" aria-label="Account">
        <Link href="/login" className="nav-link">
          Log in
        </Link>
        <Link href="/signup" className="btn btn-solid btn-white btn-sm">
          Sign up
        </Link>
      </nav>
    </header>
  );
}
