/**
 * Design tokens. A hotel's colours: deep ink and brass on warm paper, quiet and
 * a little formal, the opposite of a utility app. Nothing outside this file
 * should contain a colour.
 */
export const colors = {
  ink: '#0E1A2B',
  inkSoft: '#18283F',
  inkLine: '#2A3B55',
  brass: '#B8935A',
  brassDeep: '#8E6E3A',
  brassSoft: '#F4ECDD',
  paper: '#F7F5F0',
  card: '#FFFFFF',
  line: '#E4DFD3',
  lineStrong: '#CFC8B8',
  text: '#1B2433',
  muted: '#6B7280',
  inverse: '#FFFFFF',
  inverseMuted: '#A9B4C6',
  ok: '#2E7D5B',
  okSoft: '#E4F2EA',
  warn: '#A06A12',
  warnSoft: '#FBF0DA',
  danger: '#B83B32',
  dangerSoft: '#FBE8E6',
  info: '#2F5D8C',
  infoSoft: '#E6EEF7',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const font = { xs: 12, sm: 13.5, md: 15.5, lg: 18, xl: 24, xxl: 32 } as const;
