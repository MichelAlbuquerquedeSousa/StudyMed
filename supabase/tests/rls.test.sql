-- Testes de Row Level Security. Cada bloco falha (raise exception) se a regra não valer.
\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

-- Usuária A cria dados
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.items (id, kind, title, category, recurrence, start_time, end_time)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'evento', 'Anatomia', 'aula',
          '{"freq":"weekly","weekdays":[1],"startsOn":"2026-11-02"}', '07:30', '09:10');
insert into public.items (id, kind, title, category, date) values ('aaaaaaaa-0000-0000-0000-000000000002', 'tarefa', 'Resumo', 'estudo', '2026-11-22');
insert into public.item_occurrences (item_id, occurrence_date, done) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-16', true);
insert into public.exams (id, subject, title, date) values ('eeeeeeee-0000-0000-0000-000000000001', 'Anatomia', 'N1', '2026-11-27');
insert into public.exam_topics (exam_id, title, position) values ('eeeeeeee-0000-0000-0000-000000000001', 'Plexo braquial', 0);
insert into public.user_settings (category_colors) values ('{"aula":"#A8DADC"}');

do $$ begin
  if (select user_id from public.items limit 1) <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'user_id deveria vir de auth.uid()';
  end if;
  raise notice 'ok - user_id preenchido automaticamente';
end $$;

-- Usuária B não enxerga nem altera nada de A
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ declare n int; begin
  select (select count(*) from public.items) + (select count(*) from public.item_occurrences)
       + (select count(*) from public.exams) + (select count(*) from public.exam_topics)
       + (select count(*) from public.user_settings) into n;
  if n <> 0 then raise exception 'B enxergou % linhas de A', n; end if;
  raise notice 'ok - outra conta não lê dados alheios';
end $$;

do $$ declare n int; begin
  update public.items set title = 'hack' where true; get diagnostics n = row_count;
  if n <> 0 then raise exception 'B alterou itens de A'; end if;
  delete from public.exams where true; get diagnostics n = row_count;
  if n <> 0 then raise exception 'B apagou provas de A'; end if;
  raise notice 'ok - outra conta não altera nem apaga dados alheios';
end $$;

do $$ begin
  begin
    insert into public.items (kind, title, category, date, user_id)
      values ('tarefa', 'forjada', 'estudo', '2026-11-22', '11111111-1111-1111-1111-111111111111');
    raise exception 'B inseriu linha em nome de A';
  exception when insufficient_privilege then raise notice 'ok - não é possível gravar em nome de outra conta';
  end;
end $$;

do $$ begin
  begin
    -- B tenta anexar ocorrência/conteúdo a item/prova de A (mesmo sabendo o UUID)
    insert into public.item_occurrences (item_id, occurrence_date, done) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-23', true);
    raise exception 'B anexou ocorrência ao item de A';
  exception when foreign_key_violation then raise notice 'ok - não é possível anexar dados a itens de outra conta';
  end;
  begin
    insert into public.exam_topics (exam_id, title) values ('eeeeeeee-0000-0000-0000-000000000001', 'x');
    raise exception 'B anexou conteúdo à prova de A';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Visitante sem login
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform count(*) from public.items;
    raise exception 'anon conseguiu ler items';
  exception when insufficient_privilege then raise notice 'ok - visitante sem login não acessa as tabelas';
  end;
end $$;

-- Restrições de integridade
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  begin
    insert into public.items (kind, title, category, date, start_time, end_time) values ('evento', 'x', 'aula', '2026-11-22', '10:00', '09:00');
    raise exception 'aceitou término antes do início';
  exception when check_violation then null; end;
  begin
    insert into public.items (kind, title, category, recurrence) values ('evento', 'x', 'aula', '{"freq":"daily"}');
    raise exception 'aceitou recorrência inválida';
  exception when check_violation then null; end;
  begin
    insert into public.items (kind, title, category, date) values ('tarefa', 'x', 'inventada', '2026-11-22');
    raise exception 'aceitou categoria inexistente';
  exception when check_violation then null; end;
  raise notice 'ok - restrições de integridade (horário, recorrência, categoria)';
end $$;

-- Exclusão em cascata
delete from public.items where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.exams where id = 'eeeeeeee-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.item_occurrences) or exists (select 1 from public.exam_topics) then
    raise exception 'cascata falhou';
  end if;
  raise notice 'ok - excluir item/prova remove ocorrências/conteúdos';
end $$;

-- updated_at
do $$ declare t0 timestamptz; t1 timestamptz; begin
  select updated_at into t0 from public.items where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  perform pg_sleep(0.01);
  update public.items set done_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  select updated_at into t1 from public.items where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  if t1 <= t0 then raise exception 'updated_at não mudou'; end if;
  raise notice 'ok - updated_at atualizado automaticamente';
end $$;
