import "./BrandMark.css"

export function BrandMark({
  compact = false,
  className = "",
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <span
      className={`brand-mark ${compact ? "brand-mark--compact" : ""} ${className}`.trim()}
    >
      <img
        className="brand-mark__image"
        src="/northstarbank-logo.svg"
        alt="NorthStarBank — Banking with direction"
      />
    </span>
  )
}
