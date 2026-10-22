"use server";

import { redirect } from "next/navigation";
import type { SeasonSettings } from "@/db/schema";
import type { WeekRules } from "@/game/attendance";
import { type ActionState, osloInput, run, text } from "@/lib/action";
import {
  addStaff,
  createSeason,
  deleteSeasonData,
  endEmergencyAccess,
  removeStaff,
  resetTemplate,
  saveTemplate,
  setPhase,
  setWeekRules,
  startEmergencyAccess,
  updateSeasonBasics,
  updateSettings,
} from "@/server/admin";
import { addManualCheckin, editCheckin } from "@/server/attendance";
import { requireGamemaster, requireSeason, requireStaff, requireViewer } from "@/server/auth/session";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/server/email";
import {
  addPlayerAsGamemaster,
  approveKill,
  disqualify,
  GameError,
  generateCircle,
  grantMercy,
  moveInCircle,
  rejectKill,
  removePlayerAsGamemaster,
  startGame,
  undoKillAsGamemaster,
} from "@/server/game";
import { approveImage, rejectImage } from "@/server/players";
import { answerQuestion, deleteQuestion, publishQuestion } from "@/server/questions";
import type { Phase } from "@/server/season";
import { buildFridayList, decideReview } from "@/server/weekly";
import { weekStartOf } from "@/game/time";

const num = (form: FormData, key: string, min: number, max: number) => {
  const value = Number(text(form, key));
  if (!Number.isFinite(value) || value < min || value > max) throw new GameError(`Ugyldig verdi for ${key}`);
  return value;
};

const time = (form: FormData, key: string) => {
  const value = text(form, key);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new GameError("Tid må skrives som TT:MM");
  return value;
};

function rulesFrom(form: FormData): WeekRules {
  const rules = {
    days: num(form, "days", 0, 5),
    hours: num(form, "hours", 0, 8),
    windowStart: time(form, "windowStart"),
    windowEnd: time(form, "windowEnd"),
    killsRequired: num(form, "killsRequired", 0, 20),
  };
  if (rules.windowStart >= rules.windowEnd) throw new GameError("Tidsvinduet må starte før det slutter");
  return rules;
}

export async function approveKillAction(_: ActionState, form: FormData) {
  return run(async () => approveKill(await requireStaff(), text(form, "killId"), text(form, "note")), "Drapet er godkjent");
}

export async function rejectKillAction(_: ActionState, form: FormData) {
  return run(async () => rejectKill(await requireStaff(), text(form, "killId"), text(form, "note")), "Drapet er avvist");
}

export async function undoKillAction(_: ActionState, form: FormData) {
  return run(async () => undoKillAsGamemaster(await requireGamemaster(), text(form, "killId")), "Drapet er angret");
}

export async function decideReviewAction(_: ActionState, form: FormData) {
  return run(async () => {
    const decision = text(form, "decision") === "disqualified" ? "disqualified" : "exception";
    await decideReview(await requireStaff(), text(form, "reviewId"), decision, text(form, "reason"));
  }, "Avgjort");
}

export async function buildFridayListAction(_: ActionState) {
  return run(async () => {
    const viewer = await requireStaff();
    const count = await buildFridayList(viewer.season, weekStartOf(new Date()));
    return `Lista er laget: ${count} til gjennomgang`;
  });
}

export async function disqualifyAction(_: ActionState, form: FormData) {
  return run(async () => disqualify(await requireStaff(), [text(form, "playerId")], text(form, "reason")), "Deltakeren er diskvalifisert");
}

export async function editCheckinAction(_: ActionState, form: FormData) {
  return run(async () => {
    const viewer = await requireStaff();
    const kind = text(form, "kind");
    if (kind === "times") {
      const out = text(form, "checkOutAt");
      await editCheckin(viewer, text(form, "checkinId"), {
        kind: "times",
        checkInAt: osloInput(text(form, "checkInAt")),
        checkOutAt: out ? osloInput(out) : null,
      });
    } else if (kind === "approve" || kind === "reject" || kind === "restore" || kind === "reviewed") {
      await editCheckin(viewer, text(form, "checkinId"), { kind });
    } else throw new GameError("Ukjent handling");
  });
}

export async function addCheckinAction(_: ActionState, form: FormData) {
  return run(async () =>
    addManualCheckin(await requireStaff(), text(form, "playerId"), osloInput(text(form, "checkInAt")), osloInput(text(form, "checkOutAt"))),
  );
}

export async function rejectImageAction(_: ActionState, form: FormData) {
  return run(async () => rejectImage(await requireStaff(), text(form, "playerId"), text(form, "message")), "Bildet er avvist");
}

export async function approveImageAction(_: ActionState, form: FormData) {
  return run(async () => approveImage(await requireStaff(), text(form, "playerId")), "Godkjent");
}

export async function answerAction(_: ActionState, form: FormData) {
  return run(async () => answerQuestion(await requireStaff(), text(form, "id"), text(form, "answer")), "Svaret er sendt");
}

export async function publishAction(_: ActionState, form: FormData) {
  return run(async () =>
    publishQuestion(await requireStaff(), text(form, "id"), text(form, "publicQuestion"), text(form, "publicAnswer"), form.get("published") === "on"),
  );
}

export async function deleteQuestionAction(_: ActionState, form: FormData) {
  return run(async () => deleteQuestion(await requireStaff(), text(form, "id")), "Spørsmålet er slettet");
}

export async function generateCircleAction(_: ActionState) {
  return run(async () => generateCircle(await requireGamemaster()), "Sirkelen er trukket");
}

export async function startGameAction(_: ActionState) {
  return run(async () => startGame(await requireGamemaster()), "Spillet er i gang. E-post om første offer er sendt.");
}

export async function moveAction(_: ActionState, form: FormData) {
  return run(async () => moveInCircle(await requireGamemaster(), text(form, "playerId"), text(form, "afterId")), "Flyttet");
}

export async function mercyAction(_: ActionState, form: FormData) {
  return run(async () => grantMercy(await requireGamemaster(), text(form, "playerId"), text(form, "afterId") || null), "Nåde gitt");
}

export async function addPlayerAction(_: ActionState, form: FormData) {
  return run(async () => addPlayerAsGamemaster(await requireGamemaster(), text(form, "userId")), "Deltakeren er lagt til");
}

export async function removePlayerAction(_: ActionState, form: FormData) {
  const result = await run(async () => removePlayerAsGamemaster(await requireGamemaster(), text(form, "playerId")), "Deltakeren er fjernet");
  if (result?.ok) redirect("/admin/deltakere");
  return result;
}

export async function createSeasonAction(_: ActionState, form: FormData) {
  return run(async () => createSeason(await requireViewer(), text(form, "name")), "Ny sesong er opprettet");
}

export async function setPhaseAction(_: ActionState, form: FormData) {
  return run(async () => setPhase(await requireGamemaster(), text(form, "phase") as Phase), "Fasen er endret");
}

export async function updateBasicsAction(_: ActionState, form: FormData) {
  return run(async () => {
    const deadline = text(form, "signupDeadline");
    const startDate = text(form, "startDate");
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new GameError("Ugyldig startdato");
    await updateSeasonBasics(await requireGamemaster(), {
      name: text(form, "name"),
      signupDeadline: deadline ? osloInput(deadline) : null,
      startDate: startDate || null,
      rulesText: text(form, "rulesText"),
      dates: text(form, "dates"),
    });
  });
}

export async function defaultRulesAction(_: ActionState, form: FormData) {
  return run(async () => updateSettings(await requireGamemaster(), { defaultRules: rulesFrom(form) }));
}

export async function weekRulesAction(_: ActionState, form: FormData) {
  return run(async () => {
    const useDefault = form.get("useDefault") === "on";
    await setWeekRules(await requireGamemaster(), text(form, "weekStart"), useDefault ? null : rulesFrom(form));
  });
}

export async function statsAction(_: ActionState, form: FormData) {
  return run(async () =>
    updateSettings(await requireGamemaster(), {
      stats: {
        killsToday: form.get("killsToday") === "on",
        sinceLastKill: form.get("sinceLastKill") === "on",
        topKillerToday: form.get("topKillerToday") === "on",
      },
    }),
  );
}

export async function milestonesAction(_: ActionState, form: FormData) {
  return run(async () => {
    const viewer = await requireGamemaster();
    const milestones: SeasonSettings["milestones"] = viewer.season.settings.milestones.map((m) => ({
      ...m,
      value: m.kind === "winner" ? 1 : num(form, `value-${m.key}`, 1, m.kind === "percent" ? 99 : 500),
      email: form.get(`email-${m.key}`) === "on",
    }));
    await updateSettings(viewer, { milestones });
  });
}

export async function officeAction(_: ActionState, form: FormData) {
  return run(async () => {
    const viewer = await requireGamemaster();
    if (!text(form, "lat") && !text(form, "lng")) return updateSettings(viewer, { office: null });
    await updateSettings(viewer, {
      office: { lat: num(form, "lat", -90, 90), lng: num(form, "lng", -180, 180), radiusMeters: num(form, "radius", 20, 5000) },
    });
  });
}

export async function deleteSeasonDataAction(_: ActionState, form: FormData) {
  return run(async () => deleteSeasonData(await requireGamemaster(), text(form, "seasonId"), text(form, "confirm")), "Sesongdata er slettet");
}

export async function addStaffAction(_: ActionState, form: FormData) {
  return run(async () => {
    const role = text(form, "role") === "gamemaster" ? "gamemaster" : "organizer";
    await addStaff(await requireSeason(), text(form, "username"), role);
  }, "Lagt til");
}

export async function removeStaffAction(_: ActionState, form: FormData) {
  return run(async () => removeStaff(await requireSeason(), text(form, "staffId")), "Fjernet");
}

export async function emergencyStartAction(_: ActionState, form: FormData) {
  return run(async () => startEmergencyAccess(await requireSeason(), text(form, "reason")), "Nødtilgang er på i én time");
}

export async function emergencyEndAction(_: ActionState) {
  return run(async () => endEmergencyAccess(await requireViewer()), "Nødtilgang er slått av");
}

export async function saveTemplateAction(_: ActionState, form: FormData) {
  return run(async () => {
    const key = text(form, "key");
    if (!(key in DEFAULT_TEMPLATES)) throw new GameError("Ukjent mal");
    if (form.get("restoreDefault") === "on") return resetTemplate(await requireGamemaster(), key as TemplateKey);
    await saveTemplate(await requireGamemaster(), key as TemplateKey, text(form, "subject"), text(form, "body"));
  });
}
