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
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      key={resetOnSuccess && state?.ok ? state.nonce : undefined}
    >
      <fieldset disabled={pending} aria-busy={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p key={`e${state.nonce ?? state.error}`} role="alert" className="appear mt-2 text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p key={`o${state.nonce ?? state.ok}`} role="status" className="appear mt-2 text-sm text-emerald-400">{state.ok}</p>}
    </form>
  );
}
