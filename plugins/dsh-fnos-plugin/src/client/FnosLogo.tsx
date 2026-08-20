/** The original transparent 128px fnOS mark supplied by the official UI. */
const FNOS_MARK_DATA_URL = 'data:image/png;base64,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'

interface FnosLogoProps {
  size?: number
  className?: string
}

/** The original blue mark used by the input-toolbar action. */
export function FnosColorLogo({ size = 18, className }: FnosLogoProps) {
  return <img aria-hidden="true" className={className} src={FNOS_MARK_DATA_URL} width={size} height={size} alt="" style={{ display: 'block', objectFit: 'contain' }} />
}

/** The same mark as a theme-aware black/white mask. */
export function FnosMonoLogo({ size = 18, className }: FnosLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        width: size,
        height: size,
        flex: '0 0 auto',
        backgroundColor: 'var(--dsw-alias-label-primary)',
        WebkitMaskImage: `url("${FNOS_MARK_DATA_URL}")`,
        maskImage: `url("${FNOS_MARK_DATA_URL}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}
