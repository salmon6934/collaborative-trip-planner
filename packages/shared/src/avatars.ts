// Default profile avatars for TripSync.
//
// These live in the shared package so the web app (picker UI) and the server
// (assigning an avatar at signup) resolve the exact same set — no drift.
//
// Design notes:
//  - Pure inline SVG markup: no network requests, works offline, safe to render
//    in hot paths like presence indicators.
//  - No width/height attributes, only a viewBox, so each avatar scales to
//    whatever box it is rendered into.
//  - Every avatar uses a unique mask id. Rendering the same avatar twice on one
//    page (e.g. nav bar + member list) would otherwise produce duplicate DOM ids
//    and the SVG masks would collide.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DefaultAvatar {
  /** Stable 1-based id. Persisted indirectly via the rendered data URI. */
  id: number;
  /** Raw SVG markup. */
  svg: string;
  /** Accessible label. */
  alt: string;
}

// ─── Avatar Set ──────────────────────────────────────────────────────────────

export const DEFAULT_AVATARS: readonly DefaultAvatar[] = [
  {
    id: 1,
    alt: 'Sunset',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sunset avatar">' +
      '<mask id="tsav1" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav1)">' +
      '<rect width="36" height="36" fill="#ff005b"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(9 -5) rotate(219 18 18) scale(1)" fill="#ffb238" rx="6"/>' +
      '<g transform="translate(4.5 -4) rotate(9 18 18)">' +
      '<path d="M15 19c2 1 4 1 6 0" stroke="#000000" fill="none" stroke-linecap="round"/>' +
      '<rect x="10" y="14" width="1.5" height="2" rx="1" fill="#000000"/>' +
      '<rect x="24" y="14" width="1.5" height="2" rx="1" fill="#000000"/>' +
      '</g></g></svg>',
  },
  {
    id: 2,
    alt: 'Ember',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ember avatar">' +
      '<mask id="tsav2" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav2)">' +
      '<rect width="36" height="36" fill="#ff7d10"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(5 -1) rotate(55 18 18) scale(1.1)" fill="#0a0310" rx="6"/>' +
      '<g transform="translate(7 -6) rotate(-5 18 18)">' +
      '<path d="M15 20c2 1 4 1 6 0" stroke="#FFFFFF" fill="none" stroke-linecap="round"/>' +
      '<rect x="14" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '<rect x="20" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '</g></g></svg>',
  },
  {
    id: 3,
    alt: 'Midnight',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Midnight avatar">' +
      '<mask id="tsav3" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav3)">' +
      '<rect width="36" height="36" fill="#0a0310"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(-3 7) rotate(227 18 18) scale(1.2)" fill="#ff005b" rx="36"/>' +
      '<g transform="translate(-3 3.5) rotate(7 18 18)">' +
      '<path d="M13,21 a1,0.75 0 0,0 10,0" fill="#FFFFFF"/>' +
      '<rect x="12" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '<rect x="22" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '</g></g></svg>',
  },
  {
    id: 4,
    alt: 'Meadow',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Meadow avatar">' +
      '<mask id="tsav4" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav4)">' +
      '<rect width="36" height="36" fill="#d8fcb3"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(9 -5) rotate(219 18 18) scale(1)" fill="#89fcb3" rx="6"/>' +
      '<g transform="translate(4.5 -4) rotate(9 18 18)">' +
      '<path d="M15 19c2 1 4 1 6 0" stroke="#000000" fill="none" stroke-linecap="round"/>' +
      '<rect x="10" y="14" width="1.5" height="2" rx="1" fill="#000000"/>' +
      '<rect x="24" y="14" width="1.5" height="2" rx="1" fill="#000000"/>' +
      '</g></g></svg>',
  },
  {
    id: 5,
    alt: 'Lagoon',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lagoon avatar">' +
      '<mask id="tsav5" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav5)">' +
      '<rect width="36" height="36" fill="#00b3a4"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(-4 -4) rotate(155 18 18) scale(1.1)" fill="#f7f7f7" rx="36"/>' +
      '<g transform="translate(2 -2) rotate(-4 18 18)">' +
      '<path d="M13,20 a1,0.75 0 0,0 10,0" fill="#0a0310"/>' +
      '<rect x="13" y="14" width="1.5" height="2" rx="1" fill="#0a0310"/>' +
      '<rect x="23" y="14" width="1.5" height="2" rx="1" fill="#0a0310"/>' +
      '</g></g></svg>',
  },
  {
    id: 6,
    alt: 'Lupine',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lupine avatar">' +
      '<mask id="tsav6" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav6)">' +
      '<rect width="36" height="36" fill="#6c5ce7"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(6 4) rotate(285 18 18) scale(1.15)" fill="#ffeaa7" rx="6"/>' +
      '<g transform="translate(-1 -3) rotate(5 18 18)">' +
      '<path d="M15 20c2 1 4 1 6 0" stroke="#0a0310" fill="none" stroke-linecap="round"/>' +
      '<rect x="11" y="14" width="1.5" height="2" rx="1" fill="#0a0310"/>' +
      '<rect x="23" y="14" width="1.5" height="2" rx="1" fill="#0a0310"/>' +
      '</g></g></svg>',
  },
  {
    id: 7,
    alt: 'Marigold',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Marigold avatar">' +
      '<mask id="tsav7" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav7)">' +
      '<rect width="36" height="36" fill="#f9d423"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(3 -6) rotate(115 18 18) scale(1.05)" fill="#e14fad" rx="36"/>' +
      '<g transform="translate(5 -1) rotate(-8 18 18)">' +
      '<path d="M13,21 a1,0.75 0 0,0 10,0" fill="#FFFFFF"/>' +
      '<rect x="12" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '<rect x="22" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '</g></g></svg>',
  },
  {
    id: 8,
    alt: 'Glacier',
    svg:
      '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Glacier avatar">' +
      '<mask id="tsav8" maskUnits="userSpaceOnUse" x="0" y="0" width="36" height="36">' +
      '<rect width="36" height="36" rx="72" fill="#FFFFFF"/></mask>' +
      '<g mask="url(#tsav8)">' +
      '<rect width="36" height="36" fill="#12c2e9"/>' +
      '<rect x="0" y="0" width="36" height="36" transform="translate(-6 2) rotate(340 18 18) scale(1.2)" fill="#0a0310" rx="6"/>' +
      '<g transform="translate(3 -5) rotate(11 18 18)">' +
      '<path d="M15 20c2 1 4 1 6 0" stroke="#FFFFFF" fill="none" stroke-linecap="round"/>' +
      '<rect x="13" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '<rect x="21" y="14" width="1.5" height="2" rx="1" fill="#FFFFFF"/>' +
      '</g></g></svg>',
  },
] as const;

// ─── Constants ───────────────────────────────────────────────────────────────

export const MIN_AVATAR_ID = 1;
export const MAX_AVATAR_ID = DEFAULT_AVATARS.length;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Narrow an untrusted value to a valid avatar id. */
export function isValidAvatarId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_AVATAR_ID &&
    value <= MAX_AVATAR_ID
  );
}

export function getAvatarById(id: number): DefaultAvatar | undefined {
  return DEFAULT_AVATARS.find((a) => a.id === id);
}

/**
 * Encodes SVG markup as a data URI suitable for an <img src>.
 *
 * Uses percent-encoding rather than base64: it stays smaller and, critically,
 * escapes the `#` in hex colours which would otherwise terminate the URI.
 */
export function avatarToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Resolves an avatar id to a renderable data URI, or null if the id is unknown. */
export function getAvatarDataUri(id: number): string | null {
  const avatar = getAvatarById(id);
  return avatar ? avatarToDataUri(avatar.svg) : null;
}

/**
 * Deterministically maps an arbitrary seed (user id, email) to an avatar id.
 *
 * Same seed always yields the same avatar, so a user's default avatar is stable
 * without needing to be stored anywhere.
 */
export function pickAvatarIdForSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % MAX_AVATAR_ID) + MIN_AVATAR_ID;
}
