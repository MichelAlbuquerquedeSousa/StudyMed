import { Suspense } from "react";
import { ExamDetail } from "@/components/exams/exam-detail";

export default function Page({ params }: PageProps<"/provas/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-2" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/provas/[id]">["params"] }) {
  const { id } = await params;
  return <ExamDetail id={id} />;
}
