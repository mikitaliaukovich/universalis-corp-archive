/** Trident mark of the Corporation (drawn inline so it follows the palette). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 4v24M8.5 7v7a7.5 7.5 0 0 0 15 0V7M16 4l-2.2 3.2h4.4zM8.5 7l-1.6 2.4h3.2zM23.5 7l-1.6 2.4h3.2zM12 26h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  )
}
