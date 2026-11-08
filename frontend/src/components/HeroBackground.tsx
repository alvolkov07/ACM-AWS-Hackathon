import Image from "next/image";
import hayField from "../../public/background/background_hay_image.png";

/** Full-bleed wheat field photo behind the hero. */
export default function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        src={hayField}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        quality={80}
        className="object-cover object-[50%_60%]"
      />
      {/* Light flat tint so the white text and logo stay readable on the bright photo. */}
      <div className="absolute inset-0 bg-[rgba(24,38,18,0.22)]" />
    </div>
  );
}
