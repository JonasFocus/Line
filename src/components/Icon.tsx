import type { SVGProps } from 'react'

export type IconName =
  | 'archive'
  | 'chevronDown'
  | 'chevronRight'
  | 'close'
  | 'document'
  | 'dots'
  | 'edit'
  | 'eye'
  | 'folder'
  | 'folderAdd'
  | 'grid'
  | 'import'
  | 'inspector'
  | 'link'
  | 'list'
  | 'newDocument'
  | 'panel'
  | 'preview'
  | 'save'
  | 'search'
  | 'share'
  | 'sort'
  | 'split'
  | 'star'
  | 'tag'
  | 'trash'
  | 'warning'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  filled?: boolean
}

const paths: Record<IconName, React.ReactNode> = {
  archive: <><path d="M4 7.5h16" /><path d="M5.5 7.5v10.25A2.25 2.25 0 0 0 7.75 20h8.5a2.25 2.25 0 0 0 2.25-2.25V7.5" /><path d="M3.5 4h17v3.5h-17z" /><path d="M9.25 11.5h5.5" /></>,
  chevronDown: <path d="m7.5 9.5 4.5 4 4.5-4" />,
  chevronRight: <path d="m9.5 7.5 4 4.5-4 4.5" />,
  close: <><path d="m7 7 10 10" /><path d="M17 7 7 17" /></>,
  document: <><path d="M7 3.5h6l4 4v13H7z" /><path d="M13 3.5v4h4" /><path d="M9.5 12h5M9.5 15.5h5" /></>,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  edit: <><path d="m5 17 1-4L16.5 2.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L9 16z" /><path d="m14.5 4.5 3 3" /><path d="M4 20h16" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.75" /></>,
  folder: <path d="M3.5 7.5h6l2-2h9v13h-17z" />,
  folderAdd: <><path d="M3.5 7.5h6l2-2h9v13h-17z" /><path d="M16.5 10.5v5M14 13h5" /></>,
  grid: <><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><circle cx="8" cy="16" r="2.5" /><circle cx="16" cy="16" r="2.5" /></>,
  import: <><path d="M4 15.5v4h16v-4" /><path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5" /></>,
  inspector: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  link: <><path d="m9.5 14.5 5-5" /><path d="M7.75 16.25 6 18a3.18 3.18 0 0 1-4.5-4.5l3.25-3.25a3.18 3.18 0 0 1 4.5 0" /><path d="m16.25 7.75 1.75-1.75a3.18 3.18 0 1 1 4.5 4.5l-3.25 3.25a3.18 3.18 0 0 1-4.5 0" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".9" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r=".9" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r=".9" fill="currentColor" stroke="none" /></>,
  newDocument: <><path d="M6.5 3.5h7l4 4v13h-11z" /><path d="M13.5 3.5v4h4M2.5 12h8M6.5 8v8" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.75" /></>,
  save: <><path d="M4 4h13l3 3v13H4z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  share: <><path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 11v9h14v-9" /></>,
  sort: <><path d="M8 4v16M4.5 7.5 8 4l3.5 3.5" /><path d="M16 20V4m-3.5 12.5L16 20l3.5-3.5" /></>,
  split: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></>,
  star: <path d="m12 3 2.75 5.55 6.13.89-4.44 4.32 1.05 6.1L12 17l-5.49 2.86 1.05-6.1-4.44-4.32 6.13-.89z" />,
  tag: <path d="M3.5 5.5v6l8.8 8.8 8-8-8.8-8.8h-6a2 2 0 0 0-2 2Z" />,
  trash: <><path d="M4.5 7h15M9 3.5h6L16.5 7h-9zM6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></>,
  warning: <><path d="m12 3 9 17H3z" /><path d="M12 9v5M12 17.5v.2" /></>,
}

export function Icon({ name, size = 18, filled = false, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.65"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
