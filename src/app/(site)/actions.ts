import * as serverActions from "./actions.server";
import { createServerFn } from "@tanstack/react-start";
import type { ActionState } from "@/lib/action";
import { MAX_IMAGE_BYTES } from "@/lib/upload";

function validateForm(value: unknown): FormData {
  if (!(value instanceof FormData)) throw new Error("Ugyldig skjema");
  for (const item of value.values())
    if (item instanceof File && item.size > MAX_IMAGE_BYTES) throw new Error("Bildet er for stort");
  return value;
}
const signUpActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.signUpAction(null, data));
export function signUpAction(_state: ActionState, form: FormData) {
  return signUpActionRpc({ data: form });
}
const withdrawActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  serverActions.withdrawAction(null),
);
export function withdrawAction(_state: ActionState) {
  return withdrawActionRpc();
}
const uploadImageActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.uploadImageAction(null, data));
export function uploadImageAction(_state: ActionState, form: FormData) {
  return uploadImageActionRpc({ data: form });
}
const defaultImageActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  serverActions.defaultImageAction(null),
);
export function defaultImageAction(_state: ActionState) {
  return defaultImageActionRpc();
}
const deleteImageActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  serverActions.deleteImageAction(null),
);
export function deleteImageAction(_state: ActionState) {
  return deleteImageActionRpc();
}
const bioActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.bioAction(null, data));
export function bioAction(_state: ActionState, form: FormData) {
  return bioActionRpc({ data: form });
}
const revealTargetActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  serverActions.revealTargetAction(),
);
export function revealTargetAction() {
  return revealTargetActionRpc();
}
const reportKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.reportKillAction(null, data));
export function reportKillAction(_state: ActionState, form: FormData) {
  return reportKillActionRpc({ data: form });
}
const confirmKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.confirmKillAction(null, data));
export function confirmKillAction(_state: ActionState, form: FormData) {
  return confirmKillActionRpc({ data: form });
}
const disputeKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.disputeKillAction(null, data));
export function disputeKillAction(_state: ActionState, form: FormData) {
  return disputeKillActionRpc({ data: form });
}
const completeScanActionRpc = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    if (
      !value ||
      typeof value !== "object" ||
      !("intent" in value) ||
      (value.intent !== "in" && value.intent !== "out")
    )
      throw new Error("Ugyldig handling");
    const position = "position" in value ? value.position : null;
    if (
      position !== null &&
      (!position ||
        typeof position !== "object" ||
        !("lat" in position) ||
        !("lng" in position) ||
        typeof position.lat !== "number" ||
        typeof position.lng !== "number" ||
        !Number.isFinite(position.lat) ||
        !Number.isFinite(position.lng) ||
        Math.abs(position.lat) > 90 ||
        Math.abs(position.lng) > 180)
    )
      throw new Error("Ugyldig posisjon");
    const intent: "in" | "out" = value.intent;
    return {
      intent,
      position: position === null ? null : { lat: Number(position.lat), lng: Number(position.lng) },
    };
  })
  .handler(async ({ data }) => serverActions.completeScanAction(data.intent, data.position));
export function completeScanAction(
  intent: "in" | "out",
  position: { lat: number; lng: number } | null,
) {
  return completeScanActionRpc({ data: { intent, position } });
}
const askActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => serverActions.askAction(null, data));
export function askAction(_state: ActionState, form: FormData) {
  return askActionRpc({ data: form });
}
const markNotificationsReadActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  serverActions.markNotificationsReadAction(),
);
export function markNotificationsReadAction() {
  return markNotificationsReadActionRpc();
}
