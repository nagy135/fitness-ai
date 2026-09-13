# Device appearance

Settings → Appearance selects a palette. The light/dark switch keeps the selected
palette and changes its appearance. Fitness AI remains the default; an existing
saved light/dark preference is preserved. Without a saved mode, appearance follows
the operating system until the user toggles it.

Preferences are frontend-only: `fitness-ai-theme` and the existing
`fitness-ai-color-scheme` key use SecureStore on native devices and localStorage
on web. They are shared by accounts on that device/browser, survive logout, and
never enter Convex. The app restores them before mounting screens. Unknown palette
IDs fall back to Fitness AI, and storage failures leave the visual switch usable.

Palette definitions live in `packages/ui/src/themes.ts`. They map upstream colors
to app semantics, with contrast adjustments for small text and action labels:

- [Gruvbox Material](https://github.com/sainnhe/gruvbox-material/blob/master/autoload/gruvbox_material.vim): medium backgrounds, material foregrounds.
- [Nord](https://www.nordtheme.com/docs/colors-and-palettes/): Polar Night, Snow Storm, Frost, and Aurora; the light appearance is an app-specific companion.
- [Everforest](https://github.com/sainnhe/everforest/blob/master/autoload/everforest.vim): medium backgrounds.
- [Gruvbox Baby](https://github.com/luisiacc/gruvbox-baby/blob/master/lua/gruvbox-baby/colors.lua): default palette; the light appearance is an app-specific companion.
- [Tokyo Night](https://github.com/folke/tokyonight.nvim): Night with a Day-inspired light appearance.
- [Catppuccin](https://github.com/catppuccin/palette/blob/main/palette.json): Latte and Mocha.

NativeWind color utilities use RGB CSS variables so existing opacity modifiers
continue working. `ThemeColorsProvider` supplies the same colors to native props
and CSS variables. Modal roots reapply variables because web portals are outside
the root's DOM scope. No native dependency or backend change is required.
