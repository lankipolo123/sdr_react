/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // Exact palette from the reference PySide6 app
        // (styles/theme_colors.py in sdr_app) - not mapped through the
        // generic shadcn semantic tokens above since these are specific
        // brand colors the UI needs to match exactly, not theme roles.
        navy: '#1F2937',
        'accent-blue': '#64AAFF',
        'border-subtle': '#E2E5EA',
        'neutral-track': '#CBD5E1',
        'text-dark': '#111827',
        'text-muted-ref': '#6B7280',
        'status-ok': '#087F23',
        'status-error': '#B00020',
        'warning-border': '#F59E0B'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
