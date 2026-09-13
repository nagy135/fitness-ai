import defaultColors from './theme.json';

export type ThemeColors = typeof defaultColors.light;
export type ThemeMode = 'light' | 'dark';

type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
};

// Semantic adaptations of the upstream palettes. Nord and Gruvbox Baby light
// are app-specific companions. Sources and variant choices: docs/themes.md.
export const appThemes = [
  {
    id: 'fitness',
    name: 'Fitness AI',
    description: 'Sage & peach',
    ...defaultColors,
  },
  {
    id: 'gruvbox-material',
    name: 'Gruvbox Material',
    description: 'Warm earth & soft amber',
    light: {
      canvas: '#fbf1c7',
      panel: '#fff9e8',
      text: '#654735',
      muted: '#7c6f64',
      line: '#d5c4a1',
      accent: '#945e00',
      accentInk: '#ffffff',
      soft: '#f2e5bc',
      danger: '#c14a4a',
      highlight: '#e9b143',
      highlightInk: '#3c3836',
    },
    dark: {
      canvas: '#282828',
      panel: '#32302f',
      text: '#d4be98',
      muted: '#a89984',
      line: '#504945',
      accent: '#d8a657',
      accentInk: '#282828',
      soft: '#3c3836',
      danger: '#ea6962',
      highlight: '#a9b665',
      highlightInk: '#282828',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic blue & frost',
    light: {
      canvas: '#eceff4',
      panel: '#ffffff',
      text: '#2e3440',
      muted: '#4c566a',
      line: '#d8dee9',
      accent: '#466784',
      accentInk: '#ffffff',
      soft: '#e5e9f0',
      danger: '#a63d4b',
      highlight: '#88c0d0',
      highlightInk: '#2e3440',
    },
    dark: {
      canvas: '#2e3440',
      panel: '#3b4252',
      text: '#eceff4',
      muted: '#d8dee9',
      line: '#4c566a',
      accent: '#88c0d0',
      accentInk: '#2e3440',
      soft: '#434c5e',
      danger: '#e6a0a8',
      highlight: '#a3be8c',
      highlightInk: '#2e3440',
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    description: 'Woodland greens & cream',
    light: {
      canvas: '#fdf6e3',
      panel: '#fffbef',
      text: '#5c6a72',
      muted: '#63705a',
      line: '#d3d8bf',
      accent: '#526c20',
      accentInk: '#ffffff',
      soft: '#efebd4',
      danger: '#c23e42',
      highlight: '#a7c080',
      highlightInk: '#2d353b',
    },
    dark: {
      canvas: '#2d353b',
      panel: '#343f44',
      text: '#d3c6aa',
      muted: '#9da9a0',
      line: '#4f585e',
      accent: '#a7c080',
      accentInk: '#2d353b',
      soft: '#3d484d',
      danger: '#e67e80',
      highlight: '#dbbc7f',
      highlightInk: '#2d353b',
    },
  },
  {
    id: 'gruvbox-baby',
    name: 'Gruvbox Baby',
    description: 'Golden yellow & cozy charcoal',
    light: {
      canvas: '#fbf1c7',
      panel: '#fff9e8',
      text: '#504945',
      muted: '#665c54',
      line: '#d5c4a1',
      accent: '#8f5902',
      accentInk: '#ffffff',
      soft: '#ebdbb2',
      danger: '#cc241d',
      highlight: '#eebd35',
      highlightInk: '#282828',
    },
    dark: {
      canvas: '#282828',
      panel: '#32302f',
      text: '#ebdbb2',
      muted: '#bdae93',
      line: '#504945',
      accent: '#eebd35',
      accentInk: '#282828',
      soft: '#3c3836',
      danger: '#fb7665',
      highlight: '#8ec07c',
      highlightInk: '#282828',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Midnight blue & neon lilac',
    light: {
      canvas: '#e1e2e7',
      panel: '#f0f1f5',
      text: '#3760bf',
      muted: '#52618c',
      line: '#b4b5b9',
      accent: '#5a4a9c',
      accentInk: '#ffffff',
      soft: '#d5d6db',
      danger: '#a93150',
      highlight: '#b6a3e8',
      highlightInk: '#24283b',
    },
    dark: {
      canvas: '#1a1b26',
      panel: '#24283b',
      text: '#c0caf5',
      muted: '#a9b1d6',
      line: '#414868',
      accent: '#7aa2f7',
      accentInk: '#1a1b26',
      soft: '#292e42',
      danger: '#f7768e',
      highlight: '#bb9af7',
      highlightInk: '#1a1b26',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: 'Latte by day, Mocha by night',
    light: {
      canvas: '#eff1f5',
      panel: '#ffffff',
      text: '#4c4f69',
      muted: '#6c6f85',
      line: '#bcc0cc',
      accent: '#8839ef',
      accentInk: '#ffffff',
      soft: '#e6e9ef',
      danger: '#d20f39',
      highlight: '#ddc6f7',
      highlightInk: '#4c4f69',
    },
    dark: {
      canvas: '#1e1e2e',
      panel: '#313244',
      text: '#cdd6f4',
      muted: '#bac2de',
      line: '#585b70',
      accent: '#cba6f7',
      accentInk: '#1e1e2e',
      soft: '#45475a',
      danger: '#f38ba8',
      highlight: '#fab387',
      highlightInk: '#1e1e2e',
    },
  },
] as const satisfies readonly ThemeDefinition[];

export type ThemeId = (typeof appThemes)[number]['id'];
export const defaultThemeId: ThemeId = 'fitness';

export function isThemeId(value: unknown): value is ThemeId {
  return appThemes.some((theme) => theme.id === value);
}

export function getTheme(id: ThemeId) {
  return appThemes.find((theme) => theme.id === id) ?? appThemes[0];
}

// RGB channels allow existing Tailwind opacity modifiers (e.g. /20) to work.
export function themeVariables(colors: ThemeColors): Record<string, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([name, hex]) => [
      `--color-${name}`,
      [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(' '),
    ]),
  );
}
