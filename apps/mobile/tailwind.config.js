/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F7F2',
        'canvas-dark': '#0B0D0F',
        panel: '#FFFFFF',
        'panel-dark': '#14181B',
        ink: '#172019',
        'ink-dark': '#F5F7F5',
        muted: '#69746D',
        'muted-dark': '#84908A',
        line: '#DDE3DE',
        'line-dark': '#29302C',
        accent: '#65A30D',
        'accent-dark': '#B9F34A',
        'accent-ink': '#0B0D0F',
        danger: '#DC2626',
        'danger-dark': '#FF6B6B',
      },
    },
  },
  plugins: [],
};
