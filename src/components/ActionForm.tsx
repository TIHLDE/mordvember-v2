"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action";

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
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    return result;
  }, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      key={resetOnSuccess && state?.ok ? state.nonce : undefined}
    >
      {/* The layout class sits on the fieldset so the status line below always lands under the controls, never beside them in a row. */}
      <fieldset disabled={pending} className={`min-w-0 ${className ?? ""}`}>
        {children}
      </fieldset>
      {state?.error && <p role="alert" className="mt-2 text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-sm text-emerald-400">{state.ok}</p>}
    </form>
  );
}
