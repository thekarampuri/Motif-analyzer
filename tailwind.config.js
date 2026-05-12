/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        card:        'var(--card)',
        panel:       'var(--panel)',
        border:      'var(--border)',
        'input-bg':  'var(--input-bg)',
        gold:        'var(--gold)',
        green:       'var(--green)',
        'green-dark':'var(--green-dark)',
      },
      borderColor: {
        DEFAULT:    'var(--border)',
        'panel-border': 'var(--panel-border)',
      },
    },
  },
  plugins: [],
}
