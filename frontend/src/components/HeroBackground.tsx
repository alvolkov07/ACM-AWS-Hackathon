import Image from "next/image";
import hayField from "../../public/background/background_hay_image.png";

type Props = {
  /** Strength of the flat dark tint over the photo (0 to 1). */
  tint?: number;
  /** Which part of the photo stays in view when it is cropped. */
  position?: string;
  /** Load eagerly; use for photos visible on first paint. */
  priority?: boolean;
  /** Hint for picking the image size, e.g. "50vw" for a half-width panel. */
  sizes?: string;
};

/** Full-bleed wheat field photo, used behind the hero and other photo panels. */
export default function HeroBackground({
  tint = 0.22,
  position = "50% 60%",
  priority = true,
  sizes = "100vw",
}: Props) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        src={hayField}
        alt=""
        fill
        priority={priority}
        placeholder="blur"
        sizes={sizes}
        quality={80}
        className="object-cover"
        style={{ objectPosition: position }}
      />
      {/* Flat tint so white text and the logo stay readable on the bright photo. */}
      <div className="absolute inset-0" style={{ background: `rgba(24, 38, 18, ${tint})` }} />
    </div>
  );
}
