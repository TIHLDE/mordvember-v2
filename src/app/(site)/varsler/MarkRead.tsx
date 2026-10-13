"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "../actions";

export function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) void markNotificationsReadAction();
  }, [hasUnread]);
  return null;
}
