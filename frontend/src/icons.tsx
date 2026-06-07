// Minimal inline icon set (stroke = currentColor) — no extra dependency.
const I = (paths, fill = false) => ({ size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {paths}
  </svg>
);

export const IconMap = I(<>
  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14" /><path d="M15 6v14" />
</>);
export const IconChart = I(<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>);
export const IconControl = I(<><line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.4" fill="currentColor" /><line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.4" fill="currentColor" /></>);
export const IconUsers = I(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 4.5a3 3 0 0 1 0 6" /><path d="M21 20c0-2.6-1.4-4.2-3.5-4.8" /></>);
export const IconSun = I(<><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = I(<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />);
export const IconLogout = I(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><line x1="5" y1="12" x2="16" y2="12" /></>);
export const IconBell = I(<><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconTraffic = I(<><rect x="9" y="3" width="6" height="18" rx="3" /><circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" /></>);
export const IconChat = I(<><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.9L3 20l1-4.3a8.2 8.2 0 0 1-1-3.9A8.4 8.4 0 0 1 11.5 3 8.4 8.4 0 0 1 21 11.5Z" /></>);
export const IconSend = I(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>);
export const IconClose = I(<><path d="M18 6 6 18M6 6l12 12" /></>);
export const IconSpark = I(<><path d="M12 3l1.8 4.9L18.5 9l-4.7 1.1L12 15l-1.8-4.9L5.5 9l4.7-1.1Z" fill="currentColor" stroke="none" /><path d="M19 14l.7 1.9 1.9.7-1.9.7L19 19l-.7-1.7-1.9-.7 1.9-.7Z" fill="currentColor" stroke="none" /></>);
