"use client";

import { useRouter } from "@tanstack/react-router";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/action";
import { IMAGE_TOO_LARGE, MAX_IMAGE_BYTES } from "@/lib/upload";

export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [tooLarge, setTooLarge] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result?.ok) await router.invalidate();
    return result;
  }, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Stopped before the action starts: an oversized body would crash the page, and a finished action resets the form.
        const oversized = [...new FormData(e.currentTarget).values()].some(
          (value) => value instanceof File && value.size > MAX_IMAGE_BYTES,
        );
        setTooLarge(oversized);
        if (oversized || (confirm && !window.confirm(confirm))) e.preventDefault();
      }}
      key={resetOnSuccess && state?.ok ? state.nonce : undefined}
    >
      {/* The layout class sits on the fieldset so the status line below always lands under the controls, never beside them in a row. */}
      <fieldset disabled={pending} aria-busy={pending} className={`min-w-0 ${className ?? ""}`}>
        {children}
      </fieldset>
      {tooLarge && (
        <p role="alert" className="appear mt-2 text-sm text-red-400">
          {IMAGE_TOO_LARGE}
        </p>
      )}
      {!tooLarge && state?.error && (
        <p
          key={`e${state.nonce ?? state.error}`}
          role="alert"
          className="appear mt-2 text-sm text-red-400"
        >
          {state.error}
        </p>
      )}
      {!tooLarge && state?.ok && (
        <p
          key={`o${state.nonce ?? state.ok}`}
          role="status"
          className="appear mt-2 text-sm text-emerald-400"
        >
          {state.ok}
        </p>
      )}
    </form>
  );
}
