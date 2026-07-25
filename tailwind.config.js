/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B5D4C',
          dark: '#08453A',
          light: '#106e5b',
        },
        accent: {
          DEFAULT: '#C9A227',
          light: '#E8C44A',
        },
        background: '#FAF8F3',
        surface: '#FFFFFF',
        text: {
          primary: '#1F2A28',
          secondary: '#6B7280',
        },
        border: '#E5E1D8',
        danger: '#B3261E',
        success: '#2F9E44',
      },
      fontFamily: {
        heading: ['Fraunces', 'serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 20px rgba(0,0,0,0.06)',
        'soft-lg': '0 8px 30px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
