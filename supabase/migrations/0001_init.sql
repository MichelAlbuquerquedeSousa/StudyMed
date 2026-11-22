-- =====================================================================
-- StudyMed — esquema inicial
-- Rode este arquivo inteiro no Supabase: Dashboard → SQL Editor → New query.
-- É seguro rodar uma vez em um projeto novo.
--
-- Segurança: toda tabela tem user_id e Row Level Security (RLS).
-- Cada pessoa autenticada só enxerga e altera as próprias linhas;
-- visitantes sem login (role "anon") não têm acesso a nada.
-- =====================================================================

-- ---------- Funções auxiliares ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Preferências do usuário ----------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  category_colors jsonb not null default '{}'::jsonb
    check (jsonb_typeof(category_colors) = 'object'),
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  updated_at timestamptz not null default now()
);

-- ---------- Lotes de importação (Etapa 5; criado agora para as referências) ----------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('texto', 'pdf', 'imagem')),
  file_name text,
  raw_text text,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmado', 'descartado')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ---------- Itens da agenda: eventos fixos e tarefas concluíveis ----------

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('evento', 'tarefa')),
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (category in ('aula', 'pratica', 'tutoria', 'estudo', 'pessoal', 'prova')),
  -- Data de itens avulsos; itens recorrentes usam "recurrence".
  date date,
  -- Horários locais de Fortaleza (America/Fortaleza). Nulo = sem horário.
  start_time time,
  end_time time,
  location text check (char_length(location) <= 200),
  notes text check (char_length(notes) <= 4000),
  -- {"freq":"weekly","weekdays":[1,3],"startsOn":"2026-03-02","endsOn":"2026-07-10"}
  recurrence jsonb,
  done_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'importado', 'ficticio')),
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete set null (import_batch_id),
  constraint items_end_after_start check (end_time is null or (start_time is not null and end_time > start_time)),
  constraint items_has_date_or_recurrence check (kind = 'tarefa' or date is not null or recurrence is not null),
  constraint items_done_only_tasks check (kind = 'tarefa' or done_at is null),
  constraint items_recurrence_shape check (
    recurrence is null or (
      recurrence ->> 'freq' = 'weekly'
      and jsonb_typeof(recurrence -> 'weekdays') = 'array'
      and jsonb_array_length(recurrence -> 'weekdays') between 1 and 7
      and (recurrence ->> 'startsOn') ~ '^\d{4}-\d{2}-\d{2}$'
    )
  )
);

create index items_user_date_idx on public.items (user_id, date);

-- ---------- Ajustes por ocorrência de itens recorrentes ----------
-- (concluída, cancelada ou reagendada só naquele dia)

create table public.item_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  occurrence_date date not null,
  done boolean not null default false,
  cancelled boolean not null default false,
  move_date date,
  move_start_time time,
  move_end_time time,
  updated_at timestamptz not null default now(),
  unique (item_id, occurrence_date),
  -- A ocorrência precisa pertencer a um item do MESMO usuário.
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

create index item_occurrences_user_idx on public.item_occurrences (user_id);

-- ---------- Provas e conteúdos ----------

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 120),
  title text not null check (char_length(title) between 1 and 200),
  date date not null,
  start_time time,
  location text check (char_length(location) <= 200),
  notes text check (char_length(notes) <= 4000),
  source text not null default 'manual' check (source in ('manual', 'importado', 'ficticio')),
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete set null (import_batch_id)
);

create index exams_user_date_idx on public.exams (user_id, date);

create table public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (exam_id, user_id) references public.exams (id, user_id) on delete cascade
);

create index exam_topics_exam_idx on public.exam_topics (exam_id, position);
create index exam_topics_user_idx on public.exam_topics (user_id);

-- ---------- updated_at automático ----------

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger item_occurrences_updated_at before update on public.item_occurrences
  for each row execute function public.set_updated_at();
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();
create trigger exam_topics_updated_at before update on public.exam_topics
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------

alter table public.user_settings enable row level security;
alter table public.import_batches enable row level security;
alter table public.items enable row level security;
alter table public.item_occurrences enable row level security;
alter table public.exams enable row level security;
alter table public.exam_topics enable row level security;

create policy "dono acessa suas preferências" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dono acessa seus lotes" on public.import_batches
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dono acessa seus itens" on public.items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dono acessa suas ocorrências" on public.item_occurrences
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dono acessa suas provas" on public.exams
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dono acessa seus conteúdos" on public.exam_topics
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Usuária logada: privilégios explícitos (projetos novos podem não expor tabelas automaticamente).
-- O RLS acima continua restringindo cada linha à dona.
grant select, insert, update, delete on public.user_settings, public.import_batches, public.items,
  public.item_occurrences, public.exams, public.exam_topics to authenticated;

-- Visitantes sem login não recebem nenhum privilégio nessas tabelas.
revoke all on public.user_settings, public.import_batches, public.items,
  public.item_occurrences, public.exams, public.exam_topics from anon;

-- ---------- Realtime (sincronização entre computador, iPhone e tablet) ----------
-- O Realtime respeita as políticas de RLS acima.

alter publication supabase_realtime add table
  public.user_settings, public.items, public.item_occurrences, public.exams, public.exam_topics;
