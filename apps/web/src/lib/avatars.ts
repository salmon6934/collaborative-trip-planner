import {
  DEFAULT_AVATARS,
  avatarToDataUri,
  pickAvatarIdForSeed,
  MIN_AVATAR_ID,
  MAX_AVATAR_ID,
} from '@tripsync/shared';

/**
 * A selectable default avatar.
 *
 * `svg` is the source of truth; `src` is the derived data URI actually rendered.
 * Rendering via a data URI (rather than inlining the markup) keeps every avatar
 * in its own document, so the SVG mask ids can never collide when the same
 * avatar appears more than once on a page.
 */
export interface Avatar {
  id: number;
  alt: string;
  /** Raw SVG markup. */
  svg: string;
  /** Ready-to-render `data:image/svg+xml,...` URI. */
  src: string;
}

/**
 * The full default avatar set, pre-encoded once at module load.
 *
 * Pure SVG — no network requests, so this is safe to render in hot paths like
 * presence indicators, and it works offline.
 */
export const AVATARS: readonly Avatar[] = DEFAULT_AVATARS.map((avatar) => ({
  ...avatar,
  src: avatarToDataUri(avatar.svg),
}));

export function getAvatar(id: number): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}

/** Resolves an avatar id to its data URI, falling back to the first avatar. */
export function getAvatarSrc(id: number): string {
  return (getAvatar(id) ?? AVATARS[0]).src;
}

export { pickAvatarIdForSeed, MIN_AVATAR_ID, MAX_AVATAR_ID };
