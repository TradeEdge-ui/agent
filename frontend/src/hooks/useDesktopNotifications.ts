import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listNotifications } from '../services/resources'

/** Fires real browser desktop notifications (the native Notification API)
 * for new, unread backend notifications -- approvals needed, tasks/workflows
 * completed or failed (spec #36). Permission is only requested on first use
 * (never silently assumed), and everything degrades gracefully if the
 * browser denies or doesn't support it: the in-app notification list (via
 * `listNotifications`) still works either way. */
export function useDesktopNotifications(enabled: boolean) {
  const seenIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)
  const permissionRequested = useRef(false)

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => listNotifications(true),
    refetchInterval: enabled ? 15000 : false,
    enabled,
  })

  useEffect(() => {
    if (!enabled || !notifications) return

    // On first load, remember what's already unread without popping a
    // notification for every stale item -- only genuinely new ones after that.
    if (!initialized.current) {
      initialized.current = true
      notifications.forEach((n) => seenIds.current.add(n.id))
      return
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return
    const newOnes = notifications.filter((n) => !seenIds.current.has(n.id))
    newOnes.forEach((n) => seenIds.current.add(n.id))
    if (newOnes.length === 0) return

    // First time we actually have something to show, ask for permission --
    // not on page load, so the browser prompt only appears when it matters.
    if (Notification.permission === 'default' && !permissionRequested.current) {
      permissionRequested.current = true
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') newOnes.forEach((n) => new Notification(n.title, { body: n.body }))
      })
      return
    }
    if (Notification.permission === 'granted') {
      newOnes.forEach((n) => new Notification(n.title, { body: n.body }))
    }
  }, [enabled, notifications])

  return { unreadCount: notifications?.length ?? 0 }
}
