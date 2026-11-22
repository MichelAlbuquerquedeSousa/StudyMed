import type { Metadata } from "next";
import { ImportView } from "@/components/import/import-view";

export const metadata: Metadata = { title: "Importar planejamento" };

export default function Page() {
  return <ImportView />;
}
