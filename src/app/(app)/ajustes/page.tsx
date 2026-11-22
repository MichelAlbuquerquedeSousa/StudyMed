import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Ajustes" };

export default function Page() {
  return <SettingsView />;
}
