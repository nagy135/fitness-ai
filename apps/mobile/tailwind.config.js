/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(
        Object.entries(require('../../packages/ui/src/theme.json')).flatMap(([mode, colors]) =>
          Object.entries(colors).map(([name, value]) => [
            `${{ text: 'ink', accentInk: 'accent-ink', highlightInk: 'highlight-ink' }[name] ?? name}${mode === 'dark' ? '-dark' : ''}`,
            value,
          ]),
        ),
      ),
    },
  },
  plugins: [],
};
