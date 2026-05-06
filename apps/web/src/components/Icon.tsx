import type { CSSProperties } from 'react';

export type IconName =
  | 'send'
  | 'plus'
  | 'mic'
  | 'search'
  | 'attach'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-right'
  | 'sparkle'
  | 'edit'
  | 'menu'
  | 'panel'
  | 'more'
  | 'copy'
  | 'thumb-up'
  | 'thumb-down'
  | 'refresh'
  | 'image'
  | 'globe'
  | 'code'
  | 'sun'
  | 'moon'
  | 'play'
  | 'pause'
  | 'arrow-up'
  | 'stop'
  | 'check'
  | 'star'
  | 'history'
  | 'cloud-sun'
  | 'star-line'
  | 'message-dots'
  | 'activity'
  | 'check-square'
  | 'wx-sun'
  | 'wx-cloud'
  | 'wx-partly'
  | 'wx-rain'
  | 'settings'
  | 'x'
  | 'pin'
  | 'folder'
  | 'logo';

interface IconProps {
  name: IconName | string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, stroke = 1.6, style }: IconProps) {
  const s: CSSProperties = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    display: 'block',
    ...style,
  };
  switch (name) {
    case 'send':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M5 12l14-7-7 14-2-6-5-1z" /></svg>);
    case 'plus':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" /></svg>);
    case 'mic':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
    case 'search':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
    case 'attach':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m21 11-9 9a5 5 0 1 1-7-7l9-9a3.5 3.5 0 1 1 5 5l-9 9a2 2 0 1 1-3-3l8-8" /></svg>);
    case 'chevron-left':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m15 18-6-6 6-6" /></svg>);
    case 'chevron-down':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m6 9 6 6 6-6" /></svg>);
    case 'chevron-right':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m9 18 6-6-6-6" /></svg>);
    case 'sparkle':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3v4m0 10v4m9-9h-4M7 12H3m13.5-6.5-2.8 2.8m-5.4 5.4-2.8 2.8m11 0-2.8-2.8M8.3 8.3 5.5 5.5" /></svg>);
    case 'edit':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
    case 'menu':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 6h18M3 12h18M3 18h18" /></svg>);
    case 'panel':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>);
    case 'more':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></svg>);
    case 'copy':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
    case 'thumb-up':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M7 10v11M3 14v5a2 2 0 0 0 2 2h11a3 3 0 0 0 3-2.5l1-6A2 2 0 0 0 18 10h-5l1-4a2 2 0 0 0-2-2l-5 6" /></svg>);
    case 'thumb-down':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M17 14V3M21 10V5a2 2 0 0 0-2-2H8a3 3 0 0 0-3 2.5l-1 6A2 2 0 0 0 6 14h5l-1 4a2 2 0 0 0 2 2l5-6" /></svg>);
    case 'refresh':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>);
    case 'image':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>);
    case 'globe':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
    case 'code':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>);
    case 'sun':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>);
    case 'moon':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
    case 'play':
      return (<svg viewBox="0 0 24 24" style={s}><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" /></svg>);
    case 'pause':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></svg>);
    case 'arrow-up':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 19V5M5 12l7-7 7 7" /></svg>);
    case 'stop':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></svg>);
    case 'check':
      return (<svg viewBox="0 0 24 24" style={s}><path d="m5 12 5 5L20 7" /></svg>);
    case 'star':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3l2.7 6.3L21 10l-5 4.6 1.5 6.4L12 17.8 6.5 21 8 14.6 3 10l6.3-.7z" /></svg>);
    case 'history':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" /></svg>);
    case 'cloud-sun':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="8" cy="8" r="3" /><path d="M8 2v1M2 8h1M3.5 3.5l.7.7M12.5 3.5l-.7.7" /><path d="M16 14a4 4 0 0 0-7.6-1.5A3.5 3.5 0 1 0 8 19h8a3 3 0 1 0 0-5z" /></svg>);
    case 'star-line':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M12 3l2.7 6.3L21 10l-5 4.6 1.5 6.4L12 17.8 6.5 21 8 14.6 3 10l6.3-.7z" /></svg>);
    case 'message-dots':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" /><circle cx="9" cy="12" r="0.6" fill="currentColor" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /><circle cx="15" cy="12" r="0.6" fill="currentColor" /></svg>);
    case 'activity':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>);
    case 'check-square':
      return (<svg viewBox="0 0 24 24" style={s}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></svg>);
    case 'wx-sun':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></svg>);
    case 'wx-cloud':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M6.5 18a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 18 10.5a3.5 3.5 0 0 1 0 7H6.5z" /></svg>);
    case 'wx-partly':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="8" cy="7" r="2.5" /><path d="M8 2.5v1M2.5 7h1M3.7 3.7l.7.7M12.3 3.7l-.7.7" /><path d="M7.5 19a4 4 0 1 1 1-7.9A5 5 0 0 1 18 11.5a3 3 0 0 1 0 6h-10.5z" /></svg>);
    case 'wx-rain':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M6.5 14.5a4 4 0 1 1 1-7.9A5 5 0 0 1 18 7.5a3 3 0 0 1 0 6h-11z" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></svg>);
    case 'settings':
      return (<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
    case 'x':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M18 6 6 18M6 6l12 12" /></svg>);
    case 'pin':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M9 4h6M10 4v7l-3 3h10l-3-3V4M12 17v4" /></svg>);
    case 'folder':
      return (<svg viewBox="0 0 24 24" style={s}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>);
    case 'logo':
      return (
        <svg viewBox="0 0 24 24" style={{ ...s, fill: 'currentColor', stroke: 'none' }}>
          <path d="M4 20 L12 4 L20 20 Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}
