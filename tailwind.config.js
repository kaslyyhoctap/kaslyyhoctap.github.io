/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind CSS v4: configuration is primarily done via CSS @import and @theme.
  // This legacy config file is kept for content path customization and
  // compatibility with shadcn/ui tooling.
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Port existing CSS variables from styles.css
      colors: {
        primary: 'var(--primary)',
        'primary-h': 'var(--primary-h)',
        'on-primary': 'var(--on-primary)',
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        card: 'var(--card)',
        'card-fg': 'var(--card-fg)',
        muted: 'var(--muted)',
        'muted-fg': 'var(--muted-fg)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
};
