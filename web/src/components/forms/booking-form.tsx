"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Honeypot, Input, Textarea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { createBooking } from "@/actions/public";
import { cn } from "@/lib/cn";
import type { Slot } from "@/lib/booking";

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function BookingForm({ slots, defaults }: { slots: Slot[]; defaults?: { name?: string; email?: string; phone?: string } }) {
  const days = useMemo(() => Array.from(new Set(slots.map((s) => s.date))), [slots]);
  const [day, setDay] = useState(days[0] ?? "");
  const [slot, setSlot] = useState<string>("");
  const daySlots = slots.filter((s) => s.date === day);

  if (slots.length === 0) {
    return (
      <Alert tone="warning" title="No open slots right now">
        Please <Link href="/contact" className="underline">send us a message</Link> and we&apos;ll find a time that works.
      </Alert>
    );
  }

  return (
    <ActionForm
      action={createBooking}
      className="space-y-6"
      successContent={(s) => (
        <Card className="text-center">
          <h2 className="text-xl font-semibold text-fg">You&apos;re booked!</h2>
          <p className="mt-3 text-muted">{s.message} A confirmation with a calendar invite is on its way to your inbox.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link className={buttonClass("primary")} href="/get-quote">Share your requirements</Link>
            <Link className={buttonClass("secondary")} href="/services">Explore services</Link>
          </div>
        </Card>
      )}
    >
      {(state) => (
        <>
          <Honeypot />
          <div>
            <p className="mb-3 text-sm font-medium text-fg">1. Choose a day <span className="text-subtle">(Malaysia time)</span></p>
            <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Available days">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={d === day}
                  onClick={() => { setDay(d); setSlot(""); }}
                  className={cn("shrink-0 rounded-xl border px-4 py-2.5 text-sm transition", d === day ? "border-brand-400 bg-brand-500/15 text-fg" : "border-white/10 text-muted hover:border-white/20")}
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-fg">2. Pick a time</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {daySlots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={slot === s.start}
                  onClick={() => setSlot(s.start)}
                  className={cn("rounded-lg border px-2 py-2 text-sm tabular-nums transition", slot === s.start ? "border-brand-400 bg-brand-500/20 text-fg" : "border-white/10 text-muted hover:border-white/25")}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="slot" value={slot} />
            {state.fieldErrors?.slot && <p className="mt-2 text-xs text-red-300">{state.fieldErrors.slot}</p>}
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-fg">3. Your details</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name *" htmlFor="b-name" error={state.fieldErrors?.name}><Input id="b-name" name="name" defaultValue={defaults?.name} autoComplete="name" required /></Field>
              <Field label="Email *" htmlFor="b-email" error={state.fieldErrors?.email}><Input id="b-email" name="email" type="email" defaultValue={defaults?.email} autoComplete="email" required /></Field>
              <Field label="Phone / WhatsApp" htmlFor="b-phone" error={state.fieldErrors?.phone}><Input id="b-phone" name="phone" type="tel" defaultValue={defaults?.phone} autoComplete="tel" /></Field>
              <Field label="Company" htmlFor="b-company" error={state.fieldErrors?.company}><Input id="b-company" name="company" autoComplete="organization" /></Field>
            </div>
            <Field className="mt-5" label="What would you like to discuss? *" htmlFor="b-topic" error={state.fieldErrors?.topic}>
              <Input id="b-topic" name="topic" placeholder="E.g. new website for my bakery with online orders" required />
            </Field>
            <Field className="mt-5" label="Anything else we should know?" htmlFor="b-notes" error={state.fieldErrors?.notes}>
              <Textarea id="b-notes" name="notes" rows={3} />
            </Field>
          </div>
          <div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <Checkbox name="consent" required />
              <span>I agree to the <Link href="/legal/privacy" className="text-brand-300 underline" target="_blank">Privacy Policy</Link>.</span>
            </label>
            {state.fieldErrors?.consent && <p className="mt-1.5 text-xs text-red-300">{state.fieldErrors.consent}</p>}
          </div>
          <SubmitButton size="lg" pendingText="Booking…">Confirm free consultation</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
