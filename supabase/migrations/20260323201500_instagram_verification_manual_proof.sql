do $$
begin
  alter type public.profile_verification_proof_status
    add value if not exists 'submitted';
exception
  when duplicate_object then null;
end
$$;

create or replace function public.submit_profile_verification_proof_evidence(
  input_request_id uuid,
  input_post_url text default null,
  input_post_text text default null,
  input_proof_handle text default null,
  input_provider_user_id text default null,
  input_profile_url text default null,
  input_display_name text default null,
  input_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.profile_verification_requests%rowtype;
  normalized_post_url text := nullif(trim(input_post_url), '');
  normalized_post_text text := nullif(trim(input_post_text), '');
  normalized_provider_user_id text := nullif(trim(input_provider_user_id), '');
  normalized_profile_url text := nullif(trim(input_profile_url), '');
  normalized_display_name text := nullif(trim(input_display_name), '');
  normalized_avatar_url text := nullif(trim(input_avatar_url), '');
  normalized_handle text := lower(trim(coalesce(input_proof_handle, '')));
begin
  if input_request_id is null then
    raise exception 'Verification request is required.'
      using errcode = '23502';
  end if;

  normalized_handle := regexp_replace(normalized_handle, '^@+', '');
  normalized_handle := nullif(regexp_replace(normalized_handle, '\s+', '', 'g'), '');

  select *
  into target_request
  from public.profile_verification_requests
  where id = input_request_id
  limit 1;

  if not found then
    raise exception 'Verification request not found.'
      using errcode = 'P0002';
  end if;

  if target_request.status = 'verified' then
    raise exception 'This verification request is already approved.'
      using errcode = '22023';
  end if;

  if normalized_post_url is null and normalized_post_text is null and normalized_handle is null then
    raise exception 'Add a public proof URL, proof text, or handle before submitting proof.'
      using errcode = '23502';
  end if;

  update public.profile_verification_requests
  set
    proof_status = 'submitted',
    proof_post_url = coalesce(normalized_post_url, proof_post_url),
    proof_posted_text = coalesce(normalized_post_text, proof_posted_text),
    proof_handle = coalesce(normalized_handle, proof_handle, claimed_handle),
    proof_provider_user_id = coalesce(normalized_provider_user_id, proof_provider_user_id),
    proof_checked_at = timezone('utc', now()),
    proof_verified_at = null,
    proof_error = null
  where id = target_request.id
  returning *
  into target_request;

  if target_request.social_account_id is not null then
    update public.profile_social_accounts
    set
      provider_user_id = coalesce(normalized_provider_user_id, provider_user_id),
      handle = coalesce(normalized_handle, handle),
      display_name = coalesce(normalized_display_name, display_name),
      profile_url = coalesce(normalized_profile_url, profile_url),
      avatar_url = coalesce(normalized_avatar_url, avatar_url),
      linked_at = timezone('utc', now())
    where id = target_request.social_account_id;
  end if;

  return jsonb_build_object(
    'id', target_request.id,
    'notificationId', null,
    'proofCheckedAt', target_request.proof_checked_at,
    'proofError', target_request.proof_error,
    'proofHandle', target_request.proof_handle,
    'proofPostId', target_request.proof_post_id,
    'proofPostUrl', target_request.proof_post_url,
    'proofPostedText', target_request.proof_posted_text,
    'proofStatus', target_request.proof_status::text,
    'proofVerifiedAt', target_request.proof_verified_at,
    'status', target_request.status::text
  );
end;
$$;

create or replace function public.staff_review_profile_verification_request(
  input_session_token text,
  input_request_id uuid,
  input_status text,
  input_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  target_request public.profile_verification_requests%rowtype;
  target_profile public.profiles%rowtype;
  normalized_status public.profile_verification_status;
  normalized_note text := nullif(trim(input_admin_note), '');
  notification_id uuid;
  has_proof boolean;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token);

  if input_request_id is null then
    raise exception 'Verification request is required.'
      using errcode = '23502';
  end if;

  begin
    normalized_status := lower(trim(coalesce(input_status, '')))::public.profile_verification_status;
  exception
    when others then
      raise exception 'Unsupported verification review status.'
        using errcode = '22P02';
  end;

  if normalized_status not in ('verified', 'flagged', 'rejected') then
    raise exception 'Verification requests can only be reviewed as verified, flagged, or rejected.'
      using errcode = '22023';
  end if;

  select *
  into target_request
  from public.profile_verification_requests
  where id = input_request_id
  limit 1;

  if not found then
    raise exception 'Verification request not found.'
      using errcode = 'P0002';
  end if;

  has_proof := target_request.proof_post_url is not null
    or target_request.proof_posted_text is not null
    or target_request.proof_handle is not null;

  update public.profile_verification_requests
  set
    status = normalized_status,
    admin_note = coalesce(normalized_note, admin_note),
    reviewed_at = timezone('utc', now()),
    reviewed_by_admin_id = actor_record.admin_id,
    proof_status = case
      when normalized_status = 'verified' and has_proof then 'verified'::public.profile_verification_proof_status
      when normalized_status in ('flagged', 'rejected') and has_proof and proof_status <> 'verified'::public.profile_verification_proof_status then 'failed'::public.profile_verification_proof_status
      else proof_status
    end,
    proof_checked_at = case
      when has_proof then timezone('utc', now())
      else proof_checked_at
    end,
    proof_verified_at = case
      when normalized_status = 'verified' and has_proof then timezone('utc', now())
      else proof_verified_at
    end,
    proof_error = case
      when normalized_status in ('flagged', 'rejected') and has_proof and proof_status <> 'verified'::public.profile_verification_proof_status
        then coalesce(normalized_note, proof_error)
      when normalized_status = 'verified'
        then null
      else proof_error
    end
  where id = target_request.id
  returning *
  into target_request;

  if normalized_status = 'verified' then
    update public.profile_social_accounts
    set
      is_primary = true,
      is_verified = true,
      handle = coalesce(target_request.proof_handle, handle),
      provider_user_id = coalesce(target_request.proof_provider_user_id, provider_user_id),
      last_verified_at = timezone('utc', now())
    where id = target_request.social_account_id;

    update public.profile_verification_requests
    set
      status = 'rejected',
      admin_note = coalesce(admin_note, 'Superseded after verification approval.'),
      reviewed_at = coalesce(reviewed_at, timezone('utc', now())),
      reviewed_by_admin_id = coalesce(reviewed_by_admin_id, actor_record.admin_id)
    where profile_id = target_request.profile_id
      and id <> target_request.id
      and status = 'pending';

    update public.profiles
    set
      verification_status = 'verified',
      verification_category = coalesce(target_request.category, verification_category),
      verified_at = timezone('utc', now()),
      verified_by_admin_id = actor_record.admin_id,
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Official creator approved',
      'Your account now carries the official creator badge on Every1.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_approved',
        'provider', target_request.provider::text,
        'requestId', target_request.id
      )
    );
  elsif normalized_status = 'flagged' then
    update public.profile_social_accounts
    set
      is_verified = false
    where id = target_request.social_account_id;

    update public.profiles
    set
      verification_status = case
        when verification_status = 'verified' then verification_status
        else 'flagged'
      end,
      verification_category = coalesce(target_request.category, verification_category),
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Verification needs more review',
      'Your official creator request was flagged for additional review.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_flagged',
        'requestId', target_request.id
      )
    );
  else
    update public.profile_social_accounts
    set
      is_verified = false
    where id = target_request.social_account_id;

    update public.profiles
    set
      verification_status = case
        when verification_status = 'verified' then verification_status
        else 'unverified'
      end,
      verification_category = coalesce(target_request.category, verification_category),
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Verification request declined',
      'Your official creator request was reviewed but not approved yet.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_rejected',
        'requestId', target_request.id
      )
    );
  end if;

  return jsonb_build_object(
    'id', target_request.id,
    'notificationId', notification_id,
    'note', coalesce(normalized_note, target_request.admin_note),
    'profileId', target_request.profile_id,
    'proofStatus', target_request.proof_status::text,
    'status', target_request.status::text
  );
end;
$$;

grant execute on function public.submit_profile_verification_proof_evidence(uuid, text, text, text, text, text, text, text) to anon, authenticated;
