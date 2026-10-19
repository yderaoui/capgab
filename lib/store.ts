"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Analysis, Receipt } from "./models";
export interface LocalWatch {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  position: string;
  scenario: string;
}
export interface LocalAlert {
  id: string;
  mint: string;
  kind: string;
  threshold: number;
  enabled: boolean;
}
interface State {
  recent: Analysis[];
  watch: LocalWatch[];
  alerts: LocalAlert[];
  receipts: Receipt[];
  addScan: (a: Analysis) => void;
  addWatch: (a: LocalWatch) => void;
  removeWatch: (id: string) => void;
  addAlert: (a: LocalAlert) => void;
  removeAlert: (id: string) => void;
  addReceipt: (r: Receipt) => void;
}
export const useStore = create<State>()(
  persist(
    (set) => ({
      recent: [],
      watch: [],
      alerts: [],
      receipts: [],
      addScan: (a) =>
        set((s) => ({
          recent: [
            a,
            ...s.recent.filter((x) => x.capturedAt !== a.capturedAt),
          ].slice(0, 100),
        })),
      addWatch: (a) =>
        set((s) => ({ watch: [a, ...s.watch.filter((x) => x.id !== a.id)] })),
      removeWatch: (id) =>
        set((s) => ({ watch: s.watch.filter((x) => x.id !== id) })),
      addAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts] })),
      removeAlert: (id) =>
        set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),
      addReceipt: (r) =>
        set((s) => ({ receipts: [r, ...s.receipts].slice(0, 20) })),
    }),
    { name: "capgap-demo-v1" },
  ),
);
