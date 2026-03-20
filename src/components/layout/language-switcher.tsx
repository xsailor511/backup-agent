"use client"

import { useState, useRef, useEffect } from "react"
import { Globe } from "lucide-react"
import { useTranslation, localeOptions } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLocale = localeOptions.find((l) => l.code === locale) || localeOptions[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs">{currentLocale.flag}</span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 min-w-[120px] overflow-hidden rounded-md border bg-popover p-1 shadow-md">
          {localeOptions.map((option) => (
            <button
              key={option.code}
              onClick={() => {
                setLocale(option.code)
                setIsOpen(false)
              }}
              className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
                locale === option.code
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span className="mr-2">{option.flag}</span>
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
