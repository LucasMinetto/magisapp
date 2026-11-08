/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f1a',
        bgElevated: '#1a1a2e',
        border: '#1a1a2e',
        accent: '#3b82f6',
        accentHover: '#2563eb',
        text: '#e8e8f0',
        textMuted: '#8888a0',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        pv: '#22c55e',
        pe: '#3b82f6',
        san: '#f43f5e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
