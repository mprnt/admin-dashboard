import type { Config } from 'tailwindcss';

/**
 * Mirrors mprnt-qr's token mapping so the two apps share one visual language.
 * Colours live in app/globals.css; this file only exposes them to Tailwind.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)',
          light: 'rgb(var(--color-secondary-light) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          secondary: 'rgb(var(--color-surface-secondary) / <alpha-value>)',
          sunken: 'rgb(var(--color-surface-sunken) / <alpha-value>)',
        },
        // Primary rendered as text/icons on a surface. Use this instead of
        // `primary` for anything that must be read, not just seen.
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        float: 'var(--shadow-float)',
      },
      borderRadius: {
        '2xl': '1.125rem',
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        header: 'var(--header-height)',
        'mobile-nav': 'var(--mobile-nav-height)',
      },
      screens: {
        // Extra-small phones (iPhone SE and similar) need their own step;
        // several stat grids go single-column below this.
        xs: '400px',
      },
    },
  },
  plugins: [],
};

export default config;
