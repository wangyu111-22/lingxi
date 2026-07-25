"use client";

import BottomTabBar from "./BottomTabBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomTabBar />
    </>
  );
}
