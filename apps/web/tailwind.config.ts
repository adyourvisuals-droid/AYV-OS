import type { Config } from 'tailwindcss';

/**
 * Tailwind is configured to consume the semantic tokens declared in
 * globals.css rather than raw palette values. Components reference
 * `bg-surface`, `text-secondary`, `border-subtle` — never a hex code — which
 * is what makes the light/dark switch a single source change.
 *
 * See docs/04-design-system.md.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
        },
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        sunken: 'var(--bg-sunken)',
        glass: 'var(--bg-glass)',

        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',

        subtle: 'var(--border-subtle)',
        strong: 'var(--border-strong)',

        success: 'var(--success)',
        'success-bg': 'var(--success-bg)',
        warning: 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        danger: 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        ai: 'var(--ai)',
        'ai-bg': 'var(--ai-bg)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-sm': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading-md': ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-sm': ['15px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '21px' }],
        'body-sm': ['13px', { lineHeight: '19px' }],
        caption: ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        overline: ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(.16, 1, .3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .2s cubic-bezier(.16,1,.3,1)',
        'scale-in': 'scale-in .15s cubic-bezier(.16,1,.3,1)',
        'slide-in-left': 'slide-in-left .22s cubic-bezier(.16,1,.3,1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
