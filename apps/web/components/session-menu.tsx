"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState } from "react"

export function SessionMenu({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className="session" ref={root}>
      <button
        type="button"
        className="session-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Image className="session-avatar" src={avatarUrl} alt="" width={32} height={32} />
        <span className="session-name">{name}</span>
        <svg className="session-caret" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="session-menu" id={menuId} role="menu">
          <a role="menuitem" href="/api/auth/logout">
            Sign out
          </a>
        </div>
      ) : null}
    </div>
  )
}
