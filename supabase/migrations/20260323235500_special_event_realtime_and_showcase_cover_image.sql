alter table public.showcase_posts
  add column if not exists cover_image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'showcase_posts_cover_image_url_length'
  ) then
    alter table public.showcase_posts
      add constraint showcase_posts_cover_image_url_length check (
        cover_image_url is null
        or char_length(trim(cover_image_url)) between 8 and 2048
      );
  end if;
end
$$;

drop function if exists public.get_public_showcase_posts();

create or replace function public.get_public_showcase_posts()
returns table (
  id uuid,
  slug text,
  category text,
  title text,
  description text,
  read_time text,
  published_at date,
  content jsonb,
  cover_image_url text,
  cover_class_name text,
  pill_class_name text,
  icon_key text,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    post.id,
    post.slug,
    post.category,
    post.title,
    post.description,
    post.read_time,
    post.published_at,
    post.content,
    post.cover_image_url,
    post.cover_class_name,
    post.pill_class_name,
    post.icon_key,
    post.sort_order
  from public.showcase_posts post
  where post.is_published = true
  order by post.published_at desc, post.sort_order asc, post.created_at desc;
$$;

drop function if exists public.list_staff_showcase_posts();

create or replace function public.list_staff_showcase_posts()
returns table (
  id uuid,
  slug text,
  category text,
  title text,
  description text,
  read_time text,
  published_at date,
  content jsonb,
  cover_image_url text,
  cover_class_name text,
  pill_class_name text,
  icon_key text,
  is_published boolean,
  sort_order integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    post.id,
    post.slug,
    post.category,
    post.title,
    post.description,
    post.read_time,
    post.published_at,
    post.content,
    post.cover_image_url,
    post.cover_class_name,
    post.pill_class_name,
    post.icon_key,
    post.is_published,
    post.sort_order,
    post.created_at
  from public.showcase_posts post
  order by post.published_at desc, post.sort_order asc, post.created_at desc;
$$;

drop function if exists public.staff_upsert_showcase_post(
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  jsonb,
  text,
  text,
  text,
  boolean,
  integer,
  uuid
);

create or replace function public.staff_upsert_showcase_post(
  input_id uuid default null,
  input_slug text default null,
  input_category text default null,
  input_title text default null,
  input_description text default null,
  input_read_time text default '3 min read',
  input_published_at date default current_date,
  input_content jsonb default '[]'::jsonb,
  input_cover_image_url text default null,
  input_cover_class_name text default null,
  input_pill_class_name text default null,
  input_icon_key text default 'document',
  input_is_published boolean default true,
  input_sort_order integer default 0,
  input_updated_by_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_slug text := lower(
    regexp_replace(coalesce(input_slug, ''), '[^a-zA-Z0-9-]', '-', 'g')
  );
  result public.showcase_posts%rowtype;
begin
  normalized_slug := regexp_replace(normalized_slug, '-{2,}', '-', 'g');
  normalized_slug := trim(both '-' from normalized_slug);

  if normalized_slug = '' then
    raise exception 'Showcase slug is required.';
  end if;

  if jsonb_typeof(coalesce(input_content, '[]'::jsonb)) <> 'array' then
    raise exception 'Showcase content must be a JSON array of paragraphs.';
  end if;

  insert into public.showcase_posts (
    id,
    slug,
    category,
    title,
    description,
    read_time,
    published_at,
    content,
    cover_image_url,
    cover_class_name,
    pill_class_name,
    icon_key,
    is_published,
    sort_order,
    created_by,
    updated_by
  )
  values (
    coalesce(input_id, gen_random_uuid()),
    normalized_slug,
    coalesce(nullif(trim(input_category), ''), 'Product'),
    coalesce(nullif(trim(input_title), ''), 'Untitled update'),
    coalesce(nullif(trim(input_description), ''), 'Every1 showcase update.'),
    coalesce(nullif(trim(input_read_time), ''), '3 min read'),
    coalesce(input_published_at, current_date),
    coalesce(input_content, '[]'::jsonb),
    nullif(trim(input_cover_image_url), ''),
    coalesce(
      nullif(trim(input_cover_class_name), ''),
      'bg-[linear-gradient(135deg,#111827_0%,#1f2937_50%,#10b981_100%)]'
    ),
    coalesce(
      nullif(trim(input_pill_class_name), ''),
      'bg-white/12 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/12'
    ),
    coalesce(nullif(trim(input_icon_key), ''), 'document'),
    coalesce(input_is_published, true),
    coalesce(input_sort_order, 0),
    input_updated_by_profile_id,
    input_updated_by_profile_id
  )
  on conflict (id) do update
    set
      slug = excluded.slug,
      category = excluded.category,
      title = excluded.title,
      description = excluded.description,
      read_time = excluded.read_time,
      published_at = excluded.published_at,
      content = excluded.content,
      cover_image_url = excluded.cover_image_url,
      cover_class_name = excluded.cover_class_name,
      pill_class_name = excluded.pill_class_name,
      icon_key = excluded.icon_key,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      updated_by = excluded.updated_by
  returning * into result;

  return jsonb_build_object(
    'id', result.id,
    'slug', result.slug,
    'title', result.title,
    'isPublished', result.is_published
  );
end;
$$;

drop function if exists public.list_staff_showcase_posts(text);

create or replace function public.list_staff_showcase_posts(
  input_session_token text
)
returns table (
  id uuid,
  slug text,
  category text,
  title text,
  description text,
  read_time text,
  published_at date,
  content jsonb,
  cover_image_url text,
  cover_class_name text,
  pill_class_name text,
  icon_key text,
  is_published boolean,
  sort_order integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_showcase_posts();
end;
$$;

drop function if exists public.staff_upsert_showcase_post(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  jsonb,
  text,
  text,
  text,
  boolean,
  integer,
  uuid
);

create or replace function public.staff_upsert_showcase_post(
  input_session_token text,
  input_id uuid default null,
  input_slug text default null,
  input_category text default null,
  input_title text default null,
  input_description text default null,
  input_read_time text default '3 min read',
  input_published_at date default current_date,
  input_content jsonb default '[]'::jsonb,
  input_cover_image_url text default null,
  input_cover_class_name text default null,
  input_pill_class_name text default null,
  input_icon_key text default 'document',
  input_is_published boolean default true,
  input_sort_order integer default 0,
  input_updated_by_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_upsert_showcase_post(
    input_id,
    input_slug,
    input_category,
    input_title,
    input_description,
    input_read_time,
    input_published_at,
    input_content,
    input_cover_image_url,
    input_cover_class_name,
    input_pill_class_name,
    input_icon_key,
    input_is_published,
    input_sort_order,
    input_updated_by_profile_id
  );
end;
$$;

grant execute on function public.get_public_showcase_posts() to anon, authenticated;
grant execute on function public.list_staff_showcase_posts() to anon, authenticated;
grant execute on function public.list_staff_showcase_posts(text) to anon, authenticated;
grant execute on function public.staff_upsert_showcase_post(uuid, text, text, text, text, text, date, jsonb, text, text, text, text, boolean, integer, uuid) to anon, authenticated;
grant execute on function public.staff_upsert_showcase_post(text, uuid, text, text, text, text, text, date, jsonb, text, text, text, text, boolean, integer, uuid) to anon, authenticated;

alter table public.notifications replica identity full;
alter table public.admin_special_event_campaigns replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_special_event_campaigns'
  ) then
    alter publication supabase_realtime add table public.admin_special_event_campaigns;
  end if;
end;
$$;
