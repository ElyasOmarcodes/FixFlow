import type { InputHTMLAttributes } from 'react'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
  id?: string
  disabled?: boolean
  /** `md` is the default; `lg` is for a section header where it is the only control. */
  size?: 'md' | 'lg'
  variant?: 'switch' | 'checkbox'
  checkboxClassName?: string
  checkboxProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange' | 'type'>
}

/**
 * The app's switch.
 *
 * Deliberately closed: it used to take className, knobClassName,
 * checkedClassName, uncheckedClassName and two more for the knob's travel, and
 * every call site passed its own. They drifted — one shipped a knob that
 * stopped 2px short of the track end, another built a bespoke 44×24 switch
 * with a white knob on a near-white track that was invisible in light theme.
 * Geometry and colour now live here, and a caller chooses a size.
 */
export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  id,
  disabled,
  size = 'md',
  variant = 'switch',
  checkboxClassName = 'accent-[var(--pd-c-7c6ef6)]',
  checkboxProps,
}: ToggleSwitchProps) {
  if (variant === 'checkbox') {
    return (
      <input
        {...checkboxProps}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        className={checkboxClassName}
      />
    )
  }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="pd-switch"
      data-size={size}
    >
      <span className="pd-switch-knob" />
    </button>
  )
}
