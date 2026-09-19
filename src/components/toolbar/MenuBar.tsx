import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useUiDirection } from '@/i18n'

/**
 * The application menu bar.
 *
 * What it replaces: a single row of eighteen buttons that ran out of room at
 * 1440px and started truncating its own labels. A row cannot grow, so every
 * feature added to this app had to either displace something or shrink it —
 * which is how "Localization" ended up rendered as "Localiz…".
 *
 * A menu bar is the answer desktop software settled on decades ago and it is
 * the one users already know: the top row names *kinds* of work rather than
 * individual commands, so it stays the same width whatever is added behind
 * it, and a command that is used once a month costs a menu instead of a slot
 * next to the ones used every minute.
 *
 * Keyboard behaviour follows the WAI-ARIA menubar pattern, because a menu bar
 * that can only be clicked is just a row of buttons in a costume: one tab stop
 * for the whole bar, arrows to move within and between menus, Escape to leave.
 */

export interface MenuItemSpec {
  key: string
  label: string
  /** Shown right-aligned, e.g. "Ctrl+Z". Display only — the binding lives elsewhere. */
  shortcut?: string
  icon?: IconName
  disabled?: boolean
  /** Present makes this a checkable item; the tick reflects it. */
  checked?: boolean
  /** Drawn above this item. */
  separatorBefore?: boolean
  /**
   * A caption above this item, naming the run it starts. Without one a set of
   * mutually exclusive choices — three themes, four languages — reads as four
   * loose commands that happen to be next to each other.
   */
  groupLabel?: string
  onSelect?: () => void
  /** Renders as a link, for the one item that leaves the app. */
  href?: string
}

export interface MenuSpec {
  key: string
  label: string
  items: MenuItemSpec[]
}

export function MenuBar({ menus, className }: { menus: MenuSpec[]; className?: string }) {
  const direction = useUiDirection()
  const baseId = useId()
  const barRef = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [focusedMenu, setFocusedMenu] = useState(0)
  /** Which item the keyboard is on; -1 while the pointer is driving. */
  const [focusedItem, setFocusedItem] = useState(-1)

  const close = useCallback((returnFocus: boolean) => {
    setOpenKey(null)
    setFocusedItem(-1)
    if (returnFocus) {
      barRef.current?.querySelector<HTMLButtonElement>('[data-menu-trigger][tabindex="0"]')?.focus()
    }
  }, [])

  // Any press outside the bar dismisses it — including on the canvas, which is
  // what a person expects from every other menu bar they have used.
  useEffect(() => {
    if (!openKey) return
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close(false)
    }
    const onBlur = () => close(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [openKey, close])

  const openIndex = openKey ? menus.findIndex((menu) => menu.key === openKey) : -1

  const moveMenu = (delta: number) => {
    const from = openIndex >= 0 ? openIndex : focusedMenu
    const next = (from + delta + menus.length) % menus.length
    setFocusedMenu(next)
    if (openIndex >= 0) {
      setOpenKey(menus[next].key)
      setFocusedItem(0)
    }
    barRef.current
      ?.querySelectorAll<HTMLButtonElement>('[data-menu-trigger]')[next]
      ?.focus()
  }

  /** Separators are not stops, so arrowing never lands on a divider. */
  const selectableItems = (menu: MenuSpec) => menu.items.filter((item) => !item.disabled)

  const moveItem = (menu: MenuSpec, delta: number) => {
    const items = selectableItems(menu)
    if (items.length === 0) return
    const next = focusedItem < 0
      ? (delta > 0 ? 0 : items.length - 1)
      : (focusedItem + delta + items.length) % items.length
    setFocusedItem(next)
  }

  const runItem = (item: MenuItemSpec) => {
    if (item.disabled) return
    close(false)
    item.onSelect?.()
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent, menu: MenuSpec, index: number) => {
    // Left and right follow the writing direction, so the bar walks the way it
    // reads in Pashto and Persian too.
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === forward) { event.preventDefault(); moveMenu(1) }
    else if (event.key === back) { event.preventDefault(); moveMenu(-1) }
    else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setFocusedMenu(index)
      setOpenKey(menu.key)
      setFocusedItem(0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedMenu(index)
      setOpenKey(menu.key)
      setFocusedItem(selectableItems(menu).length - 1)
    } else if (event.key === 'Escape') {
      close(false)
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent, menu: MenuSpec) => {
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === 'ArrowDown') { event.preventDefault(); moveItem(menu, 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveItem(menu, -1) }
    else if (event.key === 'Home') { event.preventDefault(); setFocusedItem(0) }
    else if (event.key === 'End') { event.preventDefault(); setFocusedItem(selectableItems(menu).length - 1) }
    else if (event.key === forward) { event.preventDefault(); moveMenu(1) }
    else if (event.key === back) { event.preventDefault(); moveMenu(-1) }
    else if (event.key === 'Escape') { event.preventDefault(); close(true) }
    else if (event.key === 'Tab') close(false)
    else if (event.key === 'Enter' || event.key === ' ') {
      const item = selectableItems(menu)[focusedItem]
      if (item) { event.preventDefault(); runItem(item) }
    }
  }

  return (
    <div
      ref={barRef}
      className={className ? `pd-menubar ${className}` : 'pd-menubar'}
      role="menubar"
      aria-label="Main"
    >
      {menus.map((menu, index) => {
        const open = openKey === menu.key
        const selectable = selectableItems(menu)
        return (
          <div key={menu.key} className="pd-menubar-item">
            <button
              type="button"
              data-menu-trigger
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={open}
              aria-controls={`${baseId}-${menu.key}`}
              // One tab stop for the whole bar: Tab reaches the menu bar, then
              // arrows move inside it.
              tabIndex={index === focusedMenu ? 0 : -1}
              className="pd-menubar-trigger"
              onClick={() => {
                setFocusedMenu(index)
                setOpenKey(open ? null : menu.key)
                setFocusedItem(-1)
              }}
              // With a menu already open, sliding along the bar switches menus
              // without a second click — the behaviour every desktop menu has.
              onPointerEnter={() => { if (openKey && !open) { setOpenKey(menu.key); setFocusedMenu(index); setFocusedItem(-1) } }}
              onKeyDown={(event) => onTriggerKeyDown(event, menu, index)}
            >
              {menu.label}
            </button>

            {open && (
              <div
                id={`${baseId}-${menu.key}`}
                role="menu"
                aria-label={menu.label}
                className="pd-menu"
                onKeyDown={(event) => onMenuKeyDown(event, menu)}
              >
                {menu.items.map((item) => {
                  const position = selectable.indexOf(item)
                  const focused = position >= 0 && position === focusedItem
                  const content = (
                    <>
                      <span className="pd-menu-icon">
                        {item.checked === true
                          ? <Icon name="check" size={13} />
                          : item.icon ? <Icon name={item.icon} size={13} /> : null}
                      </span>
                      <span className="pd-menu-label">{item.label}</span>
                      {item.shortcut && <span className="pd-menu-shortcut">{item.shortcut}</span>}
                    </>
                  )
                  return (
                    <div key={item.key} className="contents">
                      {item.separatorBefore && <div className="pd-menu-separator" role="separator" />}
                      {item.groupLabel && <p className="pd-menu-caption">{item.groupLabel}</p>}
                      {item.href ? (
                        <a
                          role="menuitem"
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          // Named explicitly so the accessible name is the
                          // command, not the command plus whatever else the row
                          // draws. The shortcut is announced as a shortcut.
                          aria-label={item.label}
                          className="pd-menu-row"
                          tabIndex={focused ? 0 : -1}
                          ref={focused ? (node) => node?.focus() : undefined}
                          onClick={() => close(false)}
                        >
                          {content}
                        </a>
                      ) : (
                        <button
                          type="button"
                          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                          aria-checked={item.checked}
                          aria-label={item.label}
                          aria-keyshortcuts={item.shortcut}
                          disabled={item.disabled}
                          className="pd-menu-row"
                          tabIndex={focused ? 0 : -1}
                          ref={focused ? (node) => node?.focus() : undefined}
                          onClick={() => runItem(item)}
                          onPointerEnter={() => setFocusedItem(position)}
                        >
                          {content}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
