import "./BrandMark.css"

export function BrandMark({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <div className={`brand-mark ${className}`.trim()}>
      <span className="brand-mark__icon" aria-hidden="true">N</span>
      {!compact && <span className="brand-mark__name">NORTHSTAR</span>}
    </div>
  )
}
