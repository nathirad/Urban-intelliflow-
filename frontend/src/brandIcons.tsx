// Brand mark icons for the social-login buttons. Colours are baked in per brand.

export const LineLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M12 3C6.5 3 2 6.65 2 11.15c0 4.03 3.6 7.4 8.46 8.04.33.07.78.22.9.5.1.26.06.66.03.92l-.14.86c-.04.26-.2 1.02.9.56 1.1-.46 5.96-3.5 8.13-6h0C21.5 14.4 22 12.83 22 11.15 22 6.65 17.5 3 12 3zM8.2 13.4H6.16a.4.4 0 0 1-.4-.4V9.3a.4.4 0 0 1 .8 0v3.3H8.2a.4.4 0 0 1 0 .8zm1.55-.4a.4.4 0 0 1-.8 0V9.3a.4.4 0 0 1 .8 0v3.7zm4.2 0a.4.4 0 0 1-.27.38.42.42 0 0 1-.13.02.4.4 0 0 1-.32-.16l-1.9-2.58V13a.4.4 0 0 1-.8 0V9.3a.4.4 0 0 1 .72-.24l1.9 2.58V9.3a.4.4 0 0 1 .8 0v3.7zm2.96-2.25a.4.4 0 0 1 0 .8h-1.13v.65h1.13a.4.4 0 0 1 0 .8h-1.53a.4.4 0 0 1-.4-.4V9.3a.4.4 0 0 1 .4-.4h1.53a.4.4 0 0 1 0 .8h-1.13v.65h1.13z" />
  </svg>
);

export const FacebookLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
  </svg>
);

export const GoogleLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.4 36.5 44 30.8 44 24c0-1.3-.1-2.5-.4-3.5z" />
  </svg>
);

export const ThaiIDLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.4 16c.5-1.4 1.7-2.1 3.1-2.1s2.6.7 3.1 2.1" />
    <line x1="14" y1="10" x2="18" y2="10" />
    <line x1="14" y1="13.5" x2="18" y2="13.5" />
  </svg>
);

export const SsoLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
