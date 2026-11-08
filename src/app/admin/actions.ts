import { createServerFn } from "@tanstack/react-start";
import type { ActionState } from "@/lib/action";
import { MAX_IMAGE_BYTES } from "@/lib/upload";

function validateForm(value: unknown): FormData {
  if (!(value instanceof FormData)) throw new Error("Ugyldig skjema");
  for (const item of value.values())
    if (item instanceof File && item.size > MAX_IMAGE_BYTES) throw new Error("Bildet er for stort");
  return value;
}
const approveKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).approveKillAction(null, data));
export function approveKillAction(_state: ActionState, form: FormData) {
  return approveKillActionRpc({ data: form });
}
const rejectKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).rejectKillAction(null, data));
export function rejectKillAction(_state: ActionState, form: FormData) {
  return rejectKillActionRpc({ data: form });
}
const undoKillActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).undoKillAction(null, data));
export function undoKillAction(_state: ActionState, form: FormData) {
  return undoKillActionRpc({ data: form });
}
const decideReviewActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).decideReviewAction(null, data));
export function decideReviewAction(_state: ActionState, form: FormData) {
  return decideReviewActionRpc({ data: form });
}
const buildFridayListActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) =>
    (await import("./actions.server")).buildFridayListAction(null, data),
  );
export function buildFridayListAction(_state: ActionState, form: FormData) {
  return buildFridayListActionRpc({ data: form });
}
const disqualifyActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).disqualifyAction(null, data));
export function disqualifyAction(_state: ActionState, form: FormData) {
  return disqualifyActionRpc({ data: form });
}
const editCheckinActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).editCheckinAction(null, data));
export function editCheckinAction(_state: ActionState, form: FormData) {
  return editCheckinActionRpc({ data: form });
}
const addCheckinActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).addCheckinAction(null, data));
export function addCheckinAction(_state: ActionState, form: FormData) {
  return addCheckinActionRpc({ data: form });
}
const rejectImageActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).rejectImageAction(null, data));
export function rejectImageAction(_state: ActionState, form: FormData) {
  return rejectImageActionRpc({ data: form });
}
const approveImageActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).approveImageAction(null, data));
export function approveImageAction(_state: ActionState, form: FormData) {
  return approveImageActionRpc({ data: form });
}
const playerImageActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).playerImageAction(null, data));
export function playerImageAction(_state: ActionState, form: FormData) {
  return playerImageActionRpc({ data: form });
}
const playerBioActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).playerBioAction(null, data));
export function playerBioAction(_state: ActionState, form: FormData) {
  return playerBioActionRpc({ data: form });
}
const answerActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).answerAction(null, data));
export function answerAction(_state: ActionState, form: FormData) {
  return answerActionRpc({ data: form });
}
const deleteQuestionActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).deleteQuestionAction(null, data));
export function deleteQuestionAction(_state: ActionState, form: FormData) {
  return deleteQuestionActionRpc({ data: form });
}
const generateCircleActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./actions.server")).generateCircleAction(null),
);
export function generateCircleAction(_state: ActionState) {
  return generateCircleActionRpc();
}
const startGameActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./actions.server")).startGameAction(null),
);
export function startGameAction(_state: ActionState) {
  return startGameActionRpc();
}
const resumeGameActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./actions.server")).resumeGameAction(null),
);
export function resumeGameAction(_state: ActionState) {
  return resumeGameActionRpc();
}
const moveActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).moveAction(null, data));
export function moveAction(_state: ActionState, form: FormData) {
  return moveActionRpc({ data: form });
}
const mercyActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).mercyAction(null, data));
export function mercyAction(_state: ActionState, form: FormData) {
  return mercyActionRpc({ data: form });
}
const addPlayerActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).addPlayerAction(null, data));
export function addPlayerAction(_state: ActionState, form: FormData) {
  return addPlayerActionRpc({ data: form });
}
const removePlayerActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).removePlayerAction(null, data));
export function removePlayerAction(_state: ActionState, form: FormData) {
  return removePlayerActionRpc({ data: form });
}
const createSeasonActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).createSeasonAction(null, data));
export function createSeasonAction(_state: ActionState, form: FormData) {
  return createSeasonActionRpc({ data: form });
}
const setPhaseActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).setPhaseAction(null, data));
export function setPhaseAction(_state: ActionState, form: FormData) {
  return setPhaseActionRpc({ data: form });
}
const updateBasicsActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).updateBasicsAction(null, data));
export function updateBasicsAction(_state: ActionState, form: FormData) {
  return updateBasicsActionRpc({ data: form });
}
const rulesActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).rulesAction(null, data));
export function rulesAction(_state: ActionState, form: FormData) {
  return rulesActionRpc({ data: form });
}
const officeActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).officeAction(null, data));
export function officeAction(_state: ActionState, form: FormData) {
  return officeActionRpc({ data: form });
}
const resetGameActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).resetGameAction(null, data));
export function resetGameAction(_state: ActionState, form: FormData) {
  return resetGameActionRpc({ data: form });
}
const addStaffActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).addStaffAction(null, data));
export function addStaffAction(_state: ActionState, form: FormData) {
  return addStaffActionRpc({ data: form });
}
const removeStaffActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).removeStaffAction(null, data));
export function removeStaffAction(_state: ActionState, form: FormData) {
  return removeStaffActionRpc({ data: form });
}
const emergencyStartActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).emergencyStartAction(null, data));
export function emergencyStartAction(_state: ActionState, form: FormData) {
  return emergencyStartActionRpc({ data: form });
}
const emergencyEndActionRpc = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./actions.server")).emergencyEndAction(null),
);
export function emergencyEndAction(_state: ActionState) {
  return emergencyEndActionRpc();
}
const saveTemplateActionRpc = createServerFn({ method: "POST" })
  .validator(validateForm)
  .handler(async ({ data }) => (await import("./actions.server")).saveTemplateAction(null, data));
export function saveTemplateAction(_state: ActionState, form: FormData) {
  return saveTemplateActionRpc({ data: form });
}
