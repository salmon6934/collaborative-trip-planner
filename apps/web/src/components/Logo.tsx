import Image from 'next/image';
import Link from 'next/link';

/**
 * TripSync brand lockup: the pin/plane mark plus the wordmark as live text.
 *
 * The mark is served from `public/brand/mark.png` (a transparent crop of the
 * source artwork). The wordmark is deliberately text rather than part of the
 * image so it stays selectable, scales with the type system, and remains legible
 * at small sizes — a baked-in wordmark turns to mush below ~100px wide.
 */

interface LogoProps {
  /** Rendered mark size in px (square). Text scales alongside it. */
  size?: number;
  /** When set, the whole lockup becomes a link to this route. */
  href?: string;
  /** Hide the wordmark and show the mark alone. */
  markOnly?: boolean;
  /** Tailwind classes for the wordmark text. */
  textClassName?: string;
  className?: string;
}

export function Logo({
  size = 32,
  href,
  markOnly = false,
  textClassName = 'text-xl font-bold text-indigo-600',
  className,
}: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <Image
        src="/brand/mark.png"
        alt={markOnly ? 'TripSync' : ''}
        width={size}
        height={size}
        // The mark is small and appears in the header of every page, so it
        // should not wait on lazy-loading.
        priority
        className="shrink-0"
        // `aria-hidden` when the wordmark is present, so screen readers don't
        // announce the brand name twice.
        aria-hidden={markOnly ? undefined : true}
      />
      {!markOnly && <span className={textClassName}>TripSync</span>}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}

export default Logo;
