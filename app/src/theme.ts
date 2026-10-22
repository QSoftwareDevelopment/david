/**
 * Design tokens, shared with Vic Connect so the two apps feel like one family:
 * limestone page, white cards that lift without heavy shadows, crimson for the
 * one primary thing on a screen, gold spent sparingly, Bricolage Grotesque for
 * headlines and the system font for everything you read to act on.
 *
 * Nothing outside this file should contain a colour. The older token names
 * (ink, brass, paper...) are kept so existing screens pick up the new look:
 * `ink` is now the primary (crimson), `brass` the gold accent.
 */
export const colors = {
  // Surfaces
  paper: '#FFF9F5', // the page: limestone, not white, so white cards lift off it
  card: '#FFFFFF',
  surfaceMuted: '#F3EBEF', // inputs, chips at rest, grouped rows
  surfacePressed: '#EBDDE4',

  // Text
  text: '#1B1416',
  muted: '#6B5F62',
  textTertiary: '#7D7073',
  inverse: '#FFFFFF',
  inverseMuted: 'rgba(255,255,255,0.8)',

  // Lines
  line: 'rgba(70, 30, 40, 0.10)',
  lineStrong: 'rgba(70, 30, 40, 0.20)',

  // Primary: crimson
  ink: '#A30133',
  inkSoft: '#F6E3E8',
  inkLine: '#7F001A',
  crimsonPressed: '#7F001A',
  burgundy: '#5E001C',

  // Accent: gold
  brass: '#FFC424',
  brassDeep: '#7A5300',
  brassSoft: '#FFF0B8',

  // Status
  ok: '#287348',
  okSoft: '#E3F2E8',
  warn: '#9A5B00',
  warnSoft: '#FDF0DA',
  danger: '#C2272D',
  dangerSoft: '#FBE4E4',
  info: '#1A5AB8',
  infoSoft: '#DFEBFC',

  /** Initials avatars: warm, distinguishable, white text on each. */
  avatars: ['#A30133', '#5E001C', '#8A4B08', '#2F5D50', '#3D4E8C', '#6B3FA0', '#9C3D54', '#2E6A8E', '#7A5C1E', '#4F6B2C'],
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const font = { xs: 12, sm: 13.5, md: 15.5, lg: 18, xl: 24, xxl: 32 } as const;

/** Headlines. Loaded in the root layout; falls back to the system font until then. */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  accent: 'BricolageGrotesque_800ExtraBold',
} as const;

/** One soft elevation. Hierarchy comes from type and grouping, not shadow. */
export const shadow = {
  card: '0 1px 2px rgba(40, 10, 20, 0.06), 0 6px 20px rgba(40, 10, 20, 0.06)',
} as const;
