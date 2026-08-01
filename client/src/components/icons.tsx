import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Svg(props: P) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </Svg>
);
export const IconTasks = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m8 12 3 3 5-6" />
  </Svg>
);
export const IconProjects = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="9" rx="1.5" />
  </Svg>
);
export const IconNotes = (p: P) => (
  <Svg {...p}>
    <path d="M5 3h9l5 5v13H5z" />
    <path d="M14 3v5h5" />
    <path d="M8 13h8M8 17h6" />
  </Svg>
);
export const IconIdeas = (p: P) => (
  <Svg {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
  </Svg>
);
export const IconHabits = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.3.4-2.3 1-3 .2 1 .8 1.6 1.5 1.8C10 7.5 11 5.5 12 3Z" />
  </Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 8 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const IconUnlock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7.5-2" />
  </Svg>
);
export const IconPalette = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.5-1-.3-.3-.5-.6-.5-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconBringFront = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V4h12" />
  </Svg>
);
export const IconSendBack = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="12" height="12" rx="2" />
    <path d="M20 8v12H8" />
  </Svg>
);
export const IconZoomIn = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
  </Svg>
);
export const IconZoomOut = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M8 11h6M20 20l-3.5-3.5" />
  </Svg>
);
export const IconStickyNote = (p: P) => (
  <Svg {...p}>
    <path d="M4 4h16v11l-5 5H4z" />
    <path d="M20 15h-5v5" />
  </Svg>
);
export const IconCard = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 9h18" />
  </Svg>
);
export const IconType = (p: P) => (
  <Svg {...p}>
    <path d="M4 6V4h16v2M12 4v16M9 20h6" />
  </Svg>
);
export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
);
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m5 18 5-5 4 4 2-2 3 3" />
  </Svg>
);
export const IconShape = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </Svg>
);
export const IconFrame = (p: P) => (
  <Svg {...p}>
    <path d="M5 3v18M19 3v18M3 5h18M3 19h18" />
  </Svg>
);
export const IconArrow = (p: P) => (
  <Svg {...p}>
    <path d="M5 19 19 5M10 5h9v9" />
  </Svg>
);
export const IconDatabase = (p: P) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8Z" />
  </Svg>
);
export const IconMonitor = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12 5 5L20 7" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Svg>
);
export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 4.6A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.3 17.3 0 0 1-3.2 4.1" />
    <path d="M6.6 6.6A17.2 17.2 0 0 0 2 12s3.6 7 10 7a10.8 10.8 0 0 0 3-.4" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
  </Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);
export const IconPages = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="3" width="13" height="16" rx="2" />
    <path d="M4 7v13a1 1 0 0 0 1 1h11" />
  </Svg>
);
export const IconBlocks = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.5 20a2 2 0 0 0 3 0" />
  </Svg>
);
export const IconBellOff = (p: P) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 0 0-9-5.2M6.2 6.2A6 6 0 0 0 6 9c0 5-2 6-2 6h13" />
    <path d="M10.5 20a2 2 0 0 0 3 0M3 3l18 18" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconCalendarRange = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4M7 15h4M13 15h4" />
  </Svg>
);
export const IconCalendarDays = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <circle cx="8" cy="14" r=".9" fill="currentColor" />
    <circle cx="12" cy="14" r=".9" fill="currentColor" />
    <circle cx="16" cy="14" r=".9" fill="currentColor" />
    <circle cx="8" cy="18" r=".9" fill="currentColor" />
    <circle cx="12" cy="18" r=".9" fill="currentColor" />
  </Svg>
);
