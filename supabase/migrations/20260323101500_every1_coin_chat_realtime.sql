alter table public.coin_chat_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'coin_chat_messages'
  ) then
    alter publication supabase_realtime add table public.coin_chat_messages;
  end if;
end;
$$;

comment on table public.coin_chat_messages is
  'Every1 off-chain coin discussion messages with realtime updates for the mobile Fans Corner chat.';
