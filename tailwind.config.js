/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          teal: {
            DEFAULT: '#2BB3A0',
            dark: '#219685',
            light: '#3FD3BD',
            soft: '#E8F8F5',
            glow: 'rgba(43, 179, 160, 0.45)',
          },
          coral: {
            DEFAULT: '#FF6B8B',
            dark: '#E05373',
            light: '#FF8DA6',
            soft: '#FFEAF0',
            glow: 'rgba(255, 107, 139, 0.4)',
          },
          peach: {
            DEFAULT: '#FF9E79',
            light: '#FFB899',
            soft: '#FFF0EA',
          },
          mint: {
            DEFAULT: '#4ECCA3',
            soft: '#EAF9F3',
          },
          blue: {
            DEFAULT: '#4E80EE',
            soft: '#EEF3FF',
          },
          cream: '#F7F8FC',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'soft-md': '0 8px 24px rgba(149, 157, 165, 0.12)',
        'soft-lg': '0 16px 40px rgba(149, 157, 165, 0.16)',
        'teal-glow': '0 10px 25px -4px rgba(43, 179, 160, 0.5)',
        'coral-glow': '0 10px 25px -4px rgba(255, 107, 139, 0.45)',
        'clay-card': '0 20px 40px -15px rgba(0, 0, 0, 0.07), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
        '5xl': '40px',
      }
    },
  },
  plugins: [],
}
