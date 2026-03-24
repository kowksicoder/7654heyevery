create table if not exists public.coin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  coin_address text not null,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint coin_chat_messages_body_length check (
    char_length(trim(body)) between 1 and 280
  ),
  constraint coin_chat_messages_coin_address_length check (
    char_length(trim(coin_address)) between 3 and 128
  )
);

create index if not exists coin_chat_messages_coin_idx
  on public.coin_chat_messages (lower(coin_address), created_at desc);

create index if not exists coin_chat_messages_author_idx
  on public.coin_chat_messages (author_profile_id, created_at desc);

alter table public.coin_chat_messages enable row level security;

drop policy if exists "coin_chat_messages_select_public" on public.coin_chat_messages;
create policy "coin_chat_messages_select_public"
  on public.coin_chat_messages
  for select
  using (true);

drop policy if exists "coin_chat_messages_insert_owner" on public.coin_chat_messages;
create policy "coin_chat_messages_insert_owner"
  on public.coin_chat_messages
  for insert
  to authenticated
  with check (auth.uid() = author_profile_id);

create or replace function public.list_coin_chat_messages(
  input_coin_address text,
  input_limit integer default 100
)
returns table (
  id uuid,
  coin_address text,
  author_profile_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_messages as (
    select
      message.id,
      lower(trim(message.coin_address)) as coin_address,
      message.author_profile_id,
      message.body,
      message.created_at
    from public.coin_chat_messages message
    where lower(trim(message.coin_address)) = lower(trim(input_coin_address))
    order by message.created_at desc
    limit greatest(coalesce(input_limit, 100), 1)
  )
  select
    message.id,
    message.coin_address,
    profile.id as author_profile_id,
    profile.username as author_username,
    profile.display_name as author_display_name,
    profile.avatar_url as author_avatar_url,
    message.body,
    message.created_at
  from latest_messages message
  inner join public.profiles profile
    on profile.id = message.author_profile_id
  order by message.created_at asc;
$$;

create or replace function public.create_coin_chat_message(
  input_coin_address text,
  input_author_profile_id uuid,
  input_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_coin_address text := lower(nullif(trim(input_coin_address), ''));
  normalized_body text := nullif(trim(input_body), '');
  target_profile public.profiles%rowtype;
  created_message public.coin_chat_messages%rowtype;
begin
  if input_author_profile_id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'missing_profile'
    );
  end if;

  if normalized_coin_address is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'missing_coin'
    );
  end if;

  if normalized_body is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'empty_message'
    );
  end if;

  select *
  into target_profile
  from public.profiles
  where id = input_author_profile_id;

  if target_profile.id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'profile_not_found'
    );
  end if;

  insert into public.coin_chat_messages (
    coin_address,
    author_profile_id,
    body
  )
  values (
    normalized_coin_address,
    input_author_profile_id,
    normalized_body
  )
  returning * into created_message;

  return jsonb_build_object(
    'coinAddress', created_message.coin_address,
    'created', true,
    'messageId', created_message.id,
    'reason', null
  );
end;
$$;

grant select on public.coin_chat_messages to anon, authenticated;
grant insert on public.coin_chat_messages to authenticated;

grant execute on function public.list_coin_chat_messages(text, integer) to anon, authenticated;
grant execute on function public.create_coin_chat_message(text, uuid, text) to anon, authenticated;

comment on table public.coin_chat_messages is
  'Every1 off-chain coin discussion messages that power the mobile Fans Corner chat composer and feed.';
