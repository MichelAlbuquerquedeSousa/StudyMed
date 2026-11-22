/**
 * Repositório de dados no Supabase. Todas as funções lançam erro em caso de falha;
 * o store faz atualização otimista e recarrega do servidor se algo der errado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "@/data/mock";
import type { Category, Exam, ExamTopic, Item, OccurrenceOverride } from "../types";
import {
  categoriesFromColors,
  colorsFromCategories,
  examToRow,
  examsFromRows,
  itemFromRow,
  itemToRow,
  occurrenceFromRow,
  occurrenceToRow,
  topicsToRows,
  type ExamRow,
  type ItemRow,
  type OccurrenceRow,
  type TopicRow,
} from "./mappers";

type SB = SupabaseClient;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export interface RemoteData extends AppData {
  categories: Category[];
}

export async function fetchAll(sb: SB): Promise<RemoteData> {
  const [items, occ, exams, topics, settings] = await Promise.all([
    sb.from("items").select("id,kind,title,category,date,start_time,end_time,location,notes,recurrence,done_at,source"),
    sb.from("item_occurrences").select("item_id,occurrence_date,done,cancelled,move_date,move_start_time,move_end_time"),
    sb.from("exams").select("id,subject,title,date,start_time,location,notes,source"),
    sb.from("exam_topics").select("id,exam_id,title,done,position"),
    sb.from("user_settings").select("category_colors").maybeSingle(),
  ]);
  return {
    items: (check(items) as ItemRow[]).map(itemFromRow),
    overrides: (check(occ) as OccurrenceRow[]).map(occurrenceFromRow),
    exams: examsFromRows(check(exams) as ExamRow[], check(topics) as TopicRow[]),
    categories: categoriesFromColors((check(settings) as { category_colors: Record<string, string> } | null)?.category_colors),
  };
}

export async function upsertItem(sb: SB, item: Item) {
  check(await sb.from("items").upsert(itemToRow(item)));
}

export async function setItemDone(sb: SB, id: string, doneAt: string | null) {
  check(await sb.from("items").update({ done_at: doneAt }).eq("id", id));
}

export async function deleteItem(sb: SB, id: string) {
  check(await sb.from("items").delete().eq("id", id));
}

export async function upsertOccurrence(sb: SB, o: OccurrenceOverride) {
  check(await sb.from("item_occurrences").upsert(occurrenceToRow(o), { onConflict: "item_id,occurrence_date" }));
}

export async function upsertExam(sb: SB, exam: Exam) {
  check(await sb.from("exams").upsert(examToRow(exam)));
}

export async function deleteExam(sb: SB, id: string) {
  check(await sb.from("exams").delete().eq("id", id));
}

export async function updateTopic(sb: SB, id: string, patch: Partial<Pick<ExamTopic, "title" | "done">>) {
  const row: Record<string, unknown> = { ...patch };
  if (patch.done !== undefined) row.done_at = patch.done ? new Date().toISOString() : null;
  check(await sb.from("exam_topics").update(row).eq("id", id));
}

export async function insertTopic(sb: SB, examId: string, topic: ExamTopic, position: number) {
  check(await sb.from("exam_topics").insert({ id: topic.id, exam_id: examId, title: topic.title, done: topic.done, position }));
}

export async function insertTopics(sb: SB, examId: string, topics: ExamTopic[]) {
  if (topics.length) check(await sb.from("exam_topics").insert(topicsToRows(examId, topics)));
}

export async function deleteTopic(sb: SB, id: string) {
  check(await sb.from("exam_topics").delete().eq("id", id));
}

/** Grava a nova ordem dos conteúdos (linhas completas, para o upsert não violar NOT NULL). */
export async function saveTopicOrder(sb: SB, examId: string, topics: ExamTopic[]) {
  check(await sb.from("exam_topics").upsert(topicsToRows(examId, topics)));
}

export async function saveCategoryColors(sb: SB, categories: Category[]) {
  check(await sb.from("user_settings").upsert({ category_colors: colorsFromCategories(categories) }, { onConflict: "user_id" }));
}

/** Insere os dados de exemplo (todos com source = 'ficticio'). */
export async function insertDemo(sb: SB, data: AppData) {
  check(await sb.from("items").insert(data.items.map(itemToRow)));
  check(await sb.from("exams").insert(data.exams.map(examToRow)));
  const topics = data.exams.flatMap((e) => topicsToRows(e.id, e.topics));
  if (topics.length) check(await sb.from("exam_topics").insert(topics));
  if (data.overrides.length) check(await sb.from("item_occurrences").insert(data.overrides.map(occurrenceToRow)));
}

/** Remove somente os dados de exemplo; ocorrências e conteúdos saem em cascata. */
export async function clearDemo(sb: SB) {
  check(await sb.from("items").delete().eq("source", "ficticio"));
  check(await sb.from("exams").delete().eq("source", "ficticio"));
}
