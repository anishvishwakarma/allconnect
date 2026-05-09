import { create } from "zustand";
import { usersApi } from "../services/api";

export interface BadgesPayload {
  chat_unread: number;
  history_pending_requests: number;
  notifications_unread: number;
}

interface BadgeState extends BadgesPayload {
  setFromApi: (b: BadgesPayload) => void;
  refresh: () => Promise<void>;
  reset: () => void;
}

const empty: BadgesPayload = {
  chat_unread: 0,
  history_pending_requests: 0,
  notifications_unread: 0,
};

export const useBadgeStore = create<BadgeState>((set) => ({
  ...empty,
  setFromApi: (b) =>
    set({
      chat_unread: b.chat_unread ?? 0,
      history_pending_requests: b.history_pending_requests ?? 0,
      notifications_unread: b.notifications_unread ?? 0,
    }),
  refresh: async () => {
    try {
      const b = await usersApi.badges();
      set({
        chat_unread: b.chat_unread ?? 0,
        history_pending_requests: b.history_pending_requests ?? 0,
        notifications_unread: b.notifications_unread ?? 0,
      });
    } catch {
      /* keep previous */
    }
  },
  reset: () => set({ ...empty }),
}));
