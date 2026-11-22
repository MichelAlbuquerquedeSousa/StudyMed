import type { Metadata } from "next";
import { ExamsView } from "@/components/exams/exams-view";

export const metadata: Metadata = { title: "Provas" };

export default function Page() {
  return <ExamsView />;
}
