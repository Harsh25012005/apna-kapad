/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  // Disabled: Tailwind's built-in fontWeight utilities use the exact same
  // class names (font-medium, font-semibold, font-bold) as our custom
  // fontFamily entries below. With both active, every "font-bold" element
  // got fontFamily AND fontWeight applied together — Android then couldn't
  // find a "bold variant" of the custom (single static weight) font family
  // and silently fell back to the system font. Disabling this corePlugin
  // means font-bold etc. only ever select the custom font file.
  corePlugins: {
    fontWeight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0891B2',
      },
      fontFamily: {
        sans: ['GoogleSansFlex_400Regular'],
        medium: ['GoogleSansFlex_500Medium'],
        semibold: ['GoogleSansFlex_600SemiBold'],
        bold: ['GoogleSansFlex_700Bold'],
      },
    },
  },
  plugins: [],
}
