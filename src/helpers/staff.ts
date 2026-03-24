import { getSupabaseClient } from "@/helpers/supabase";
import {
  clearStaffAdminSession,
  getStaffAdminSessionToken
} from "@/store/persisted/useStaffAdminStore";
import type {
  PublicCreatorOfWeekCampaign,
  PublicCreatorOverride,
  PublicExploreCoinOverride,
  ShowcasePostRecord,
  StaffAdminAccountRow,
  StaffAdminSession,
  StaffCoinLaunchRow,
  StaffCommunityVerificationRequestRow,
  StaffCreatorOfWeekCampaignRow,
  StaffCreatorRow,
  StaffDashboard,
  StaffE1xpActivityRow,
  StaffEarningsRow,
  StaffMissionRow,
  StaffMutationResult,
  StaffProfileLaunchRow,
  StaffReferralRow,
  StaffShowcasePostRow,
  StaffSpecialEventCampaignRow,
  StaffUserRow,
  StaffVerificationRequestRow
} from "@/types/staff";

export const STAFF_DASHBOARD_QUERY_KEY = "staff-dashboard";
export const STAFF_ADMIN_ACCOUNTS_QUERY_KEY = "staff-admin-accounts";
export const STAFF_ADMIN_SESSION_QUERY_KEY = "staff-admin-session";
export const STAFF_USERS_QUERY_KEY = "staff-users";
export const STAFF_COIN_LAUNCHES_QUERY_KEY = "staff-coin-launches";
export const STAFF_REFERRALS_QUERY_KEY = "staff-referrals";
export const STAFF_EARNINGS_QUERY_KEY = "staff-earnings";
export const STAFF_E1XP_ACTIVITY_QUERY_KEY = "staff-e1xp-activity";
export const STAFF_MISSIONS_QUERY_KEY = "staff-missions";
export const STAFF_SHOWCASE_QUERY_KEY = "staff-showcase";
export const STAFF_CREATORS_QUERY_KEY = "staff-creators";
export const STAFF_VERIFICATION_REQUESTS_QUERY_KEY =
  "staff-verification-requests";
export const STAFF_COMMUNITY_VERIFICATION_REQUESTS_QUERY_KEY =
  "staff-community-verification-requests";
export const STAFF_CREATOR_OF_WEEK_QUERY_KEY = "staff-creator-of-week";
export const STAFF_SPECIAL_EVENTS_QUERY_KEY = "staff-special-events";
export const STAFF_PROFILE_LAUNCHES_QUERY_KEY = "staff-profile-launches";
export const PUBLIC_SHOWCASE_QUERY_KEY = "public-showcase-posts";
export const PUBLIC_EXPLORE_OVERRIDES_QUERY_KEY = "public-explore-overrides";
export const PUBLIC_CREATOR_OVERRIDES_QUERY_KEY = "public-creator-overrides";
export const PUBLIC_CREATOR_OF_WEEK_QUERY_KEY = "public-creator-of-week";

const callRpc = async <TData>(
  fn: string,
  args?: Record<string, unknown>
): Promise<TData> => {
  const { data, error } = await getSupabaseClient().rpc(fn, args);

  if (error) {
    throw error;
  }

  return data as TData;
};

const callStaffRpc = async <TData>(
  fn: string,
  args?: Record<string, unknown>
): Promise<TData> => {
  const sessionToken = getStaffAdminSessionToken();

  if (!sessionToken) {
    throw new Error("Admin session required.");
  }

  try {
    return await callRpc<TData>(fn, {
      input_session_token: sessionToken,
      ...(args || {})
    });
  } catch (error) {
    const nextError = error as
      | {
          code?: string;
          message?: string;
        }
      | undefined;

    if (
      nextError?.code === "42501" ||
      nextError?.message?.includes("Invalid admin session")
    ) {
      clearStaffAdminSession();
      throw new Error("Your admin session expired. Please sign in again.");
    }

    throw error;
  }
};

const toNumber = (value: null | number | string | undefined) => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));

  return Number.isFinite(parsed) ? parsed : 0;
};

export const staffAdminSignIn = async (email: string, password: string) => {
  const rows = await callRpc<
    Array<{
      admin_id: string;
      display_name: null | string;
      email: string;
      session_token: string;
    }>
  >("staff_admin_sign_in", {
    input_email: email.trim().toLowerCase(),
    input_password: password.trim()
  });

  const session = rows[0];

  if (!session) {
    throw new Error("Admin login failed.");
  }

  return {
    adminId: session.admin_id,
    displayName: session.display_name,
    email: session.email,
    sessionToken: session.session_token
  } satisfies StaffAdminSession;
};

export const getStaffAdminSession = async () => {
  const sessionToken = getStaffAdminSessionToken();

  if (!sessionToken) {
    return null;
  }

  try {
    const rows = await callRpc<
      Array<{
        admin_id: string;
        display_name: null | string;
        email: string;
      }>
    >("get_staff_admin_session", {
      input_session_token: sessionToken
    });

    const session = rows[0];

    if (!session) {
      clearStaffAdminSession();
      return null;
    }

    return {
      adminId: session.admin_id,
      displayName: session.display_name,
      email: session.email,
      sessionToken
    } satisfies StaffAdminSession;
  } catch {
    clearStaffAdminSession();
    return null;
  }
};

export const staffAdminSignOut = async () => {
  const sessionToken = getStaffAdminSessionToken();

  if (!sessionToken) {
    clearStaffAdminSession();
    return;
  }

  try {
    await callRpc("staff_admin_sign_out", {
      input_session_token: sessionToken
    });
  } finally {
    clearStaffAdminSession();
  }
};

export const getPublicShowcasePosts = async () => {
  const rows = await callRpc<
    Array<{
      category: string;
      content: null | string[] | unknown;
      cover_image_url: null | string;
      cover_class_name: string;
      description: string;
      icon_key: string;
      id: string;
      pill_class_name: string;
      published_at: string;
      read_time: string;
      slug: string;
      sort_order: number;
      title: string;
    }>
  >("get_public_showcase_posts");

  return rows.map((row) => ({
    category: row.category,
    content: Array.isArray(row.content)
      ? row.content.map((item) => String(item))
      : [],
    coverClassName: row.cover_class_name,
    coverImageUrl: row.cover_image_url,
    description: row.description,
    iconKey: row.icon_key,
    id: row.id,
    pillClassName: row.pill_class_name,
    publishedAt: row.published_at,
    readTime: row.read_time,
    slug: row.slug,
    sortOrder: row.sort_order,
    title: row.title
  })) satisfies ShowcasePostRecord[];
};

export const getPublicExploreCoinOverrides = async () => {
  const rows = await callRpc<
    Array<{
      coin_address: null | string;
      is_hidden: boolean;
      launch_id: string;
      pinned_slot: null | number;
      ticker: null | string;
    }>
  >("get_public_explore_coin_overrides");

  return rows.map((row) => ({
    coinAddress: row.coin_address,
    isHidden: row.is_hidden,
    launchId: row.launch_id,
    pinnedSlot: row.pinned_slot,
    ticker: row.ticker
  })) satisfies PublicExploreCoinOverride[];
};

export const getPublicCreatorOverrides = async () => {
  const rows = await callRpc<
    Array<{
      featured_order: null | number;
      is_hidden: boolean;
      lens_account_address: null | string;
      profile_id: string;
      wallet_address: null | string;
      zora_handle: null | string;
    }>
  >("get_public_creator_overrides");

  return rows.map((row) => ({
    featuredOrder: row.featured_order,
    isHidden: row.is_hidden,
    lensAccountAddress: row.lens_account_address,
    profileId: row.profile_id,
    walletAddress: row.wallet_address,
    zoraHandle: row.zora_handle
  })) satisfies PublicCreatorOverride[];
};

export const getPublicCreatorOfWeekCampaign = async () => {
  const rows = await callRpc<
    Array<{
      avatar_url: null | string;
      banner_url: null | string;
      campaign_id: string;
      category: string;
      creator_earnings_usd: null | number | string;
      display_name: string;
      featured_price_usd: null | number | string;
      profile_id: string;
      username: null | string;
      wallet_address: null | string;
      zora_handle: null | string;
    }>
  >("get_public_creator_of_week_campaign");

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    campaignId: row.campaign_id,
    category: row.category,
    creatorEarningsUsd: toNumber(row.creator_earnings_usd),
    displayName: row.display_name,
    featuredPriceUsd: toNumber(row.featured_price_usd),
    profileId: row.profile_id,
    username: row.username,
    walletAddress: row.wallet_address,
    zoraHandle: row.zora_handle
  } satisfies PublicCreatorOfWeekCampaign;
};

export const getStaffDashboard = async () => {
  const data = await callStaffRpc<{
    creators?: {
      featured_creators?: number;
      hidden_creators?: number;
      tracked_creators?: number;
    };
    e1xp?: {
      manual_e1xp_issued?: number;
      total_e1xp_issued?: number;
    };
    earnings?: {
      paymentVolume?: number | string;
      referralCoinRewards?: number | string;
    };
    launches?: {
      hidden_coins?: number;
      launched_coins?: number;
      pinned_coins?: number;
      total_launches?: number;
    };
    missions?: {
      active_missions?: number;
      total_missions?: number;
    };
    referrals?: {
      referral_e1xp?: number;
      rewarded_referrals?: number;
      total_referrals?: number;
    };
    showcase?: {
      published_posts?: number;
      total_posts?: number;
    };
    users?: {
      blocked_users?: number;
      hidden_users?: number;
      total_users?: number;
    };
  }>("get_staff_dashboard");

  return {
    creators: {
      featuredCreators: toNumber(data.creators?.featured_creators),
      hiddenCreators: toNumber(data.creators?.hidden_creators),
      trackedCreators: toNumber(data.creators?.tracked_creators)
    },
    e1xp: {
      manualE1xpIssued: toNumber(data.e1xp?.manual_e1xp_issued),
      totalE1xpIssued: toNumber(data.e1xp?.total_e1xp_issued)
    },
    earnings: {
      paymentVolume: toNumber(data.earnings?.paymentVolume),
      referralCoinRewards: toNumber(data.earnings?.referralCoinRewards)
    },
    launches: {
      hiddenCoins: toNumber(data.launches?.hidden_coins),
      launchedCoins: toNumber(data.launches?.launched_coins),
      pinnedCoins: toNumber(data.launches?.pinned_coins),
      totalLaunches: toNumber(data.launches?.total_launches)
    },
    missions: {
      activeMissions: toNumber(data.missions?.active_missions),
      totalMissions: toNumber(data.missions?.total_missions)
    },
    referrals: {
      referralE1xp: toNumber(data.referrals?.referral_e1xp),
      rewardedReferrals: toNumber(data.referrals?.rewarded_referrals),
      totalReferrals: toNumber(data.referrals?.total_referrals)
    },
    showcase: {
      publishedPosts: toNumber(data.showcase?.published_posts),
      totalPosts: toNumber(data.showcase?.total_posts)
    },
    users: {
      blockedUsers: toNumber(data.users?.blocked_users),
      hiddenUsers: toNumber(data.users?.hidden_users),
      totalUsers: toNumber(data.users?.total_users)
    }
  } satisfies StaffDashboard;
};

export const listStaffUsers = async (search = "", limit = 40, offset = 0) => {
  const rows = await callStaffRpc<
    Array<{
      avatar_url: null | string;
      created_at: string;
      display_name: null | string;
      is_blocked: boolean;
      is_hidden: boolean;
      launches_count: number | string;
      profile_id: string;
      referrals_count: number | string;
      total_e1xp: number | string;
      username: null | string;
      wallet_address: null | string;
      zora_handle: null | string;
    }>
  >("list_staff_users", {
    input_limit: limit,
    input_offset: offset,
    input_search: search || null
  });

  return rows.map((row) => ({
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    displayName: row.display_name,
    isBlocked: row.is_blocked,
    isHidden: row.is_hidden,
    launchesCount: toNumber(row.launches_count),
    profileId: row.profile_id,
    referralsCount: toNumber(row.referrals_count),
    totalE1xp: toNumber(row.total_e1xp),
    username: row.username,
    walletAddress: row.wallet_address,
    zoraHandle: row.zora_handle
  })) satisfies StaffUserRow[];
};

export const listStaffProfileLaunches = async (profileId: string) => {
  const rows = await callStaffRpc<
    Array<{
      coin_address: null | string;
      created_at: string;
      launch_id: string;
      launched_at: null | string;
      name: string;
      status: string;
      ticker: string;
    }>
  >("list_staff_profile_launches", {
    input_profile_id: profileId
  });

  return rows.map((row) => ({
    coinAddress: row.coin_address,
    createdAt: row.created_at,
    launchedAt: row.launched_at,
    launchId: row.launch_id,
    name: row.name,
    status: row.status,
    ticker: row.ticker
  })) satisfies StaffProfileLaunchRow[];
};

export const listStaffCoinLaunches = async (
  search = "",
  limit = 50,
  offset = 0
) => {
  const rows = await callStaffRpc<
    Array<{
      coin_address: null | string;
      cover_image_url: null | string;
      created_at: string;
      creator_id: string;
      creator_name: null | string;
      creator_username: null | string;
      is_hidden: boolean;
      launch_id: string;
      launched_at: null | string;
      name: string;
      pinned_slot: null | number;
      status: string;
      ticker: string;
    }>
  >("list_staff_coin_launches", {
    input_limit: limit,
    input_offset: offset,
    input_search: search || null
  });

  return rows.map((row) => ({
    coinAddress: row.coin_address,
    coverImageUrl: row.cover_image_url,
    createdAt: row.created_at,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorUsername: row.creator_username,
    isHidden: row.is_hidden,
    launchedAt: row.launched_at,
    launchId: row.launch_id,
    name: row.name,
    pinnedSlot: row.pinned_slot,
    status: row.status,
    ticker: row.ticker
  })) satisfies StaffCoinLaunchRow[];
};

export const listStaffReferrals = async (limit = 50, offset = 0) => {
  const rows = await callStaffRpc<
    Array<{
      joined_at: null | string;
      referral_event_id: string;
      referred_name: null | string;
      referred_trade_count: number | string;
      referred_username: null | string;
      referred_wallet: null | string;
      referrer_name: null | string;
      referrer_username: null | string;
      reward_e1xp: number | string;
      rewarded_at: null | string;
      status: string;
    }>
  >("list_staff_referrals", {
    input_limit: limit,
    input_offset: offset
  });

  return rows.map((row) => ({
    joinedAt: row.joined_at,
    referralEventId: row.referral_event_id,
    referredName: row.referred_name,
    referredTradeCount: toNumber(row.referred_trade_count),
    referredUsername: row.referred_username,
    referredWallet: row.referred_wallet,
    referrerName: row.referrer_name,
    referrerUsername: row.referrer_username,
    rewardE1xp: toNumber(row.reward_e1xp),
    rewardedAt: row.rewarded_at,
    status: row.status
  })) satisfies StaffReferralRow[];
};

export const listStaffEarnings = async (limit = 50, offset = 0) => {
  const rows = await callStaffRpc<
    Array<{
      amount: number | string;
      created_at: string;
      currency: string;
      item_id: string;
      item_kind: string;
      profile_name: null | string;
      profile_username: null | string;
      status: string;
      wallet_address: null | string;
    }>
  >("list_staff_earnings", {
    input_limit: limit,
    input_offset: offset
  });

  return rows.map((row) => ({
    amount: toNumber(row.amount),
    createdAt: row.created_at,
    currency: row.currency,
    itemId: row.item_id,
    itemKind: row.item_kind,
    profileName: row.profile_name,
    profileUsername: row.profile_username,
    status: row.status,
    walletAddress: row.wallet_address
  })) satisfies StaffEarningsRow[];
};

export const listStaffE1xpActivity = async (limit = 50, offset = 0) => {
  const rows = await callStaffRpc<
    Array<{
      amount: number | string;
      created_at: string;
      description: null | string;
      ledger_id: string;
      profile_id: string;
      profile_name: null | string;
      profile_username: null | string;
      source: string;
      wallet_address: null | string;
    }>
  >("list_staff_e1xp_activity", {
    input_limit: limit,
    input_offset: offset
  });

  return rows.map((row) => ({
    amount: toNumber(row.amount),
    createdAt: row.created_at,
    description: row.description,
    ledgerId: row.ledger_id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    profileUsername: row.profile_username,
    source: row.source,
    walletAddress: row.wallet_address
  })) satisfies StaffE1xpActivityRow[];
};

export const listStaffMissions = async () => {
  const rows = await callStaffRpc<
    Array<{
      ends_at: null | string;
      mission_id: string;
      participant_count: number | string;
      reward_e1xp: number | string;
      slug: string;
      starts_at: null | string;
      status: string;
      task_count: number | string;
      title: string;
    }>
  >("list_staff_missions");

  return rows.map((row) => ({
    endsAt: row.ends_at,
    missionId: row.mission_id,
    participantCount: toNumber(row.participant_count),
    rewardE1xp: toNumber(row.reward_e1xp),
    slug: row.slug,
    startsAt: row.starts_at,
    status: row.status,
    taskCount: toNumber(row.task_count),
    title: row.title
  })) satisfies StaffMissionRow[];
};

export const listStaffShowcasePosts = async () => {
  const rows = await callStaffRpc<
    Array<{
      category: string;
      content: null | string[] | unknown;
      cover_image_url: null | string;
      cover_class_name: string;
      created_at: string;
      description: string;
      icon_key: string;
      id: string;
      is_published: boolean;
      pill_class_name: string;
      published_at: string;
      read_time: string;
      slug: string;
      sort_order: number;
      title: string;
    }>
  >("list_staff_showcase_posts");

  return rows.map((row) => ({
    category: row.category,
    content: Array.isArray(row.content)
      ? row.content.map((item) => String(item))
      : [],
    coverClassName: row.cover_class_name,
    coverImageUrl: row.cover_image_url,
    createdAt: row.created_at,
    description: row.description,
    iconKey: row.icon_key,
    id: row.id,
    isPublished: row.is_published,
    pillClassName: row.pill_class_name,
    publishedAt: row.published_at,
    readTime: row.read_time,
    slug: row.slug,
    sortOrder: row.sort_order,
    title: row.title
  })) satisfies StaffShowcasePostRow[];
};

export const listStaffCreators = async (
  search = "",
  limit = 40,
  offset = 0
) => {
  const rows = await callStaffRpc<
    Array<{
      avatar_url: null | string;
      display_name: null | string;
      featured_order: null | number;
      is_hidden: boolean;
      launches_count: number | string;
      profile_id: string;
      total_e1xp: number | string;
      username: null | string;
      wallet_address: null | string;
    }>
  >("list_staff_creators", {
    input_limit: limit,
    input_offset: offset,
    input_search: search || null
  });

  return rows.map((row) => ({
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
    featuredOrder: row.featured_order,
    isHidden: row.is_hidden,
    launchesCount: toNumber(row.launches_count),
    profileId: row.profile_id,
    totalE1xp: toNumber(row.total_e1xp),
    username: row.username,
    walletAddress: row.wallet_address
  })) satisfies StaffCreatorRow[];
};

export const listStaffVerificationRequests = async (
  status?: null | StaffVerificationRequestRow["status"],
  limit = 100,
  offset = 0
) => {
  const rows = await callStaffRpc<
    Array<{
      admin_note: null | string;
      avatar_url: null | string;
      category: null | string;
      claimed_handle: string;
      created_at: string;
      display_name: null | string;
      id: string;
      note: null | string;
      proof_checked_at: null | string;
      proof_error: null | string;
      proof_handle: null | string;
      proof_post_id: null | string;
      proof_post_url: null | string;
      proof_posted_text: null | string;
      proof_status: StaffVerificationRequestRow["proofStatus"];
      proof_verified_at: null | string;
      profile_id: string;
      provider: StaffVerificationRequestRow["provider"];
      reviewed_at: null | string;
      reviewed_by_admin_name: null | string;
      status: StaffVerificationRequestRow["status"];
      username: null | string;
      verification_code: string;
      wallet_address: null | string;
    }>
  >("list_staff_verification_requests", {
    input_limit: limit,
    input_offset: offset,
    input_status: status || null
  });

  return rows.map((row) => ({
    adminNote: row.admin_note,
    avatarUrl: row.avatar_url,
    category: row.category,
    claimedHandle: row.claimed_handle,
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    note: row.note,
    profileId: row.profile_id,
    proofCheckedAt: row.proof_checked_at,
    proofError: row.proof_error,
    proofHandle: row.proof_handle,
    proofPostedText: row.proof_posted_text,
    proofPostId: row.proof_post_id,
    proofPostUrl: row.proof_post_url,
    proofStatus: row.proof_status,
    proofVerifiedAt: row.proof_verified_at,
    provider: row.provider,
    reviewedAt: row.reviewed_at,
    reviewedByAdminName: row.reviewed_by_admin_name,
    status: row.status,
    username: row.username,
    verificationCode: row.verification_code,
    walletAddress: row.wallet_address
  })) satisfies StaffVerificationRequestRow[];
};

export const listStaffCommunityVerificationRequests = async (
  status?: null | StaffCommunityVerificationRequestRow["status"],
  limit = 100,
  offset = 0
) => {
  const rows = await callStaffRpc<
    Array<{
      admin_note: null | string;
      category: null | string;
      community_avatar_url: null | string;
      community_id: string;
      community_name: string;
      community_slug: string;
      confirmed_admin_count: number | string;
      created_at: string;
      group_platform: null | "other" | "telegram" | "whatsapp";
      group_url: null | string;
      id: string;
      note: null | string;
      requested_by_display_name: null | string;
      requested_by_profile_id: string;
      requested_by_username: null | string;
      required_admin_count: number | string;
      reviewed_at: null | string;
      reviewed_by_admin_name: null | string;
      status: StaffCommunityVerificationRequestRow["status"];
      verification_code: string;
      verification_kind: StaffCommunityVerificationRequestRow["verificationKind"];
    }>
  >("list_staff_community_verification_requests", {
    input_limit: limit,
    input_offset: offset,
    input_status: status || null
  });

  return rows.map((row) => ({
    adminNote: row.admin_note,
    category: row.category,
    communityAvatarUrl: row.community_avatar_url,
    communityId: row.community_id,
    communityName: row.community_name,
    communitySlug: row.community_slug,
    confirmedAdminCount: toNumber(row.confirmed_admin_count),
    createdAt: row.created_at,
    groupPlatform: row.group_platform,
    groupUrl: row.group_url,
    id: row.id,
    note: row.note,
    requestedByDisplayName: row.requested_by_display_name,
    requestedByProfileId: row.requested_by_profile_id,
    requestedByUsername: row.requested_by_username,
    requiredAdminCount: toNumber(row.required_admin_count),
    reviewedAt: row.reviewed_at,
    reviewedByAdminName: row.reviewed_by_admin_name,
    status: row.status,
    verificationCode: row.verification_code,
    verificationKind: row.verification_kind
  })) satisfies StaffCommunityVerificationRequestRow[];
};

export const listStaffCreatorOfWeekCampaigns = async () => {
  const rows = await callStaffRpc<
    Array<{
      avatar_url: null | string;
      banner_url: null | string;
      category: string;
      created_at: string;
      creator_earnings_usd: null | number | string;
      display_name: string;
      ends_at: null | string;
      featured_price_usd: null | number | string;
      id: string;
      is_active: boolean;
      note: null | string;
      profile_id: string;
      starts_at: null | string;
      updated_at: string;
      username: null | string;
      wallet_address: null | string;
    }>
  >("list_staff_creator_of_week_campaigns");

  return rows.map((row) => ({
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    category: row.category,
    createdAt: row.created_at,
    creatorEarningsUsd: toNumber(row.creator_earnings_usd),
    displayName: row.display_name,
    endsAt: row.ends_at,
    featuredPriceUsd: toNumber(row.featured_price_usd),
    id: row.id,
    isActive: row.is_active,
    note: row.note,
    profileId: row.profile_id,
    startsAt: row.starts_at,
    updatedAt: row.updated_at,
    username: row.username,
    walletAddress: row.wallet_address
  })) satisfies StaffCreatorOfWeekCampaignRow[];
};

export const listStaffSpecialEventCampaigns = async () => {
  const rows = await callStaffRpc<
    Array<{
      banner_url: null | string;
      body: string;
      created_at: string;
      cta_label: null | string;
      cta_url: null | string;
      delivery_kind: "notification" | "popup";
      ends_at: null | string;
      event_tag: null | string;
      id: string;
      is_active: boolean;
      priority: null | number | string;
      starts_at: null | string;
      title: string;
      triggered_at: null | string;
      updated_at: string;
    }>
  >("list_staff_special_event_campaigns");

  return rows.map((row) => ({
    bannerUrl: row.banner_url,
    body: row.body,
    createdAt: row.created_at,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    deliveryKind: row.delivery_kind,
    endsAt: row.ends_at,
    eventTag: row.event_tag,
    id: row.id,
    isActive: row.is_active,
    priority: toNumber(row.priority),
    startsAt: row.starts_at,
    title: row.title,
    triggeredAt: row.triggered_at,
    updatedAt: row.updated_at
  })) satisfies StaffSpecialEventCampaignRow[];
};

export const staffUpsertExternalProfile = (input: {
  avatarUrl?: null | string;
  bannerUrl?: null | string;
  bio?: null | string;
  displayName?: null | string;
  lensAccountAddress?: null | string;
  username?: null | string;
  walletAddress?: null | string;
  zoraHandle?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_upsert_external_profile", {
    input_avatar_url: input.avatarUrl || null,
    input_banner_url: input.bannerUrl || null,
    input_bio: input.bio || null,
    input_display_name: input.displayName || null,
    input_lens_account_address: input.lensAccountAddress || null,
    input_username: input.username || null,
    input_wallet_address: input.walletAddress || null,
    input_zora_handle: input.zoraHandle || null
  });

export const staffSetProfileModeration = (input: {
  isBlocked?: boolean;
  isHidden?: boolean;
  note?: null | string;
  profileId: string;
  updatedByWallet?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_set_profile_moderation", {
    input_is_blocked: input.isBlocked ?? false,
    input_is_hidden: input.isHidden ?? false,
    input_note: input.note || null,
    input_profile_id: input.profileId,
    input_updated_by_wallet: input.updatedByWallet || null
  });

export const staffDeleteProfile = (profileId: string) =>
  callStaffRpc<StaffMutationResult>("staff_delete_profile", {
    input_profile_id: profileId
  });

export const staffSetCoinLaunchOverride = (input: {
  isHidden?: boolean;
  launchId: string;
  note?: null | string;
  pinnedSlot?: null | number;
  updatedByWallet?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_set_coin_launch_override", {
    input_is_hidden: input.isHidden ?? false,
    input_launch_id: input.launchId,
    input_note: input.note || null,
    input_pinned_slot: input.pinnedSlot ?? null,
    input_updated_by_wallet: input.updatedByWallet || null
  });

export const staffSetCreatorOverride = (input: {
  featuredOrder?: null | number;
  isHidden?: boolean;
  note?: null | string;
  profileId: string;
  updatedByWallet?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_set_creator_override", {
    input_featured_order: input.featuredOrder ?? null,
    input_is_hidden: input.isHidden ?? false,
    input_note: input.note || null,
    input_profile_id: input.profileId,
    input_updated_by_wallet: input.updatedByWallet || null
  });

export const staffUpsertCreatorOfWeekCampaign = (input: {
  bannerUrl?: null | string;
  category: string;
  creatorEarningsUsd: number;
  featuredPriceUsd: number;
  id?: null | string;
  isActive?: boolean;
  note?: null | string;
  profileId: string;
  startsAt?: null | string;
  endsAt?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_upsert_creator_of_week_campaign", {
    input_banner_url: input.bannerUrl?.trim() || null,
    input_category: input.category.trim(),
    input_creator_earnings_usd: input.creatorEarningsUsd,
    input_ends_at: input.endsAt || null,
    input_featured_price_usd: input.featuredPriceUsd,
    input_id: input.id || null,
    input_is_active: input.isActive ?? true,
    input_note: input.note?.trim() || null,
    input_profile_id: input.profileId,
    input_starts_at: input.startsAt || null
  });

export const staffReviewVerificationRequest = (input: {
  adminNote?: null | string;
  requestId: string;
  status: Exclude<
    StaffVerificationRequestRow["status"],
    "pending" | "unverified"
  >;
}) =>
  callStaffRpc<StaffMutationResult>(
    "staff_review_profile_verification_request",
    {
      input_admin_note: input.adminNote?.trim() || null,
      input_request_id: input.requestId,
      input_status: input.status
    }
  );

export const staffReviewCommunityVerificationRequest = (input: {
  adminNote?: null | string;
  requestId: string;
  status: Exclude<
    StaffCommunityVerificationRequestRow["status"],
    "pending" | "unverified"
  >;
}) =>
  callStaffRpc<StaffMutationResult>(
    "staff_review_community_verification_request",
    {
      input_admin_note: input.adminNote?.trim() || null,
      input_request_id: input.requestId,
      input_status: input.status
    }
  );

export const staffDeleteCreatorOfWeekCampaign = (campaignId: string) =>
  callStaffRpc<StaffMutationResult>("staff_delete_creator_of_week_campaign", {
    input_id: campaignId
  });

export const staffUpsertSpecialEventCampaign = (input: {
  bannerUrl?: null | string;
  body: string;
  ctaLabel?: null | string;
  ctaUrl?: null | string;
  deliveryKind: "notification" | "popup";
  endsAt?: null | string;
  eventTag?: null | string;
  id?: null | string;
  isActive?: boolean;
  priority?: number;
  startsAt?: null | string;
  title: string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_upsert_special_event_campaign", {
    input_banner_url: input.bannerUrl?.trim() || null,
    input_body: input.body.trim(),
    input_cta_label: input.ctaLabel?.trim() || null,
    input_cta_url: input.ctaUrl?.trim() || null,
    input_delivery_kind: input.deliveryKind,
    input_ends_at: input.endsAt || null,
    input_event_tag: input.eventTag?.trim() || null,
    input_id: input.id || null,
    input_is_active: input.isActive ?? true,
    input_priority: input.priority ?? 0,
    input_starts_at: input.startsAt || null,
    input_title: input.title.trim()
  });

export const staffDeleteSpecialEventCampaign = (campaignId: string) =>
  callStaffRpc<StaffMutationResult>("staff_delete_special_event_campaign", {
    input_id: campaignId
  });

export const staffTriggerSpecialEventCampaign = (campaignId: string) =>
  callStaffRpc<StaffMutationResult>("staff_trigger_special_event_campaign", {
    input_id: campaignId
  });

export const staffGrantE1xp = (input: {
  actorProfileId?: null | string;
  amount: number;
  description?: null | string;
  metadata?: Record<string, unknown>;
  profileId: string;
  sourceKey?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_grant_e1xp", {
    input_actor_profile_id: input.actorProfileId || null,
    input_amount: input.amount,
    input_description: input.description || null,
    input_metadata: input.metadata || {},
    input_profile_id: input.profileId,
    input_source_key: input.sourceKey || null
  });

export const staffUpsertShowcasePost = (input: {
  category: string;
  content: string[];
  coverImageUrl?: null | string;
  coverClassName: string;
  description: string;
  iconKey: string;
  id?: null | string;
  isPublished?: boolean;
  pillClassName: string;
  publishedAt: string;
  readTime: string;
  slug: string;
  sortOrder?: number;
  title: string;
  updatedByProfileId?: null | string;
}) =>
  callStaffRpc<StaffMutationResult>("staff_upsert_showcase_post", {
    input_category: input.category,
    input_content: input.content,
    input_cover_class_name: input.coverClassName,
    input_cover_image_url: input.coverImageUrl?.trim() || null,
    input_description: input.description,
    input_icon_key: input.iconKey,
    input_id: input.id || null,
    input_is_published: input.isPublished ?? true,
    input_pill_class_name: input.pillClassName,
    input_published_at: input.publishedAt,
    input_read_time: input.readTime,
    input_slug: input.slug,
    input_sort_order: input.sortOrder ?? 0,
    input_title: input.title,
    input_updated_by_profile_id: input.updatedByProfileId || null
  });

export const staffDeleteShowcasePost = (postId: string) =>
  callStaffRpc<StaffMutationResult>("staff_delete_showcase_post", {
    input_id: postId
  });

export const listStaffAdminAccounts = async () => {
  const rows = await callStaffRpc<
    Array<{
      created_at: string;
      display_name: null | string;
      email: string;
      id: string;
      is_active: boolean;
    }>
  >("list_staff_admin_accounts");

  return rows.map((row) => ({
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    id: row.id,
    isActive: row.is_active
  })) satisfies StaffAdminAccountRow[];
};

export const staffAddAdminAccount = async (input: {
  displayName?: null | string;
  email: string;
  password: string;
}) => {
  const rows = await callStaffRpc<
    Array<{
      created_at: string;
      display_name: null | string;
      email: string;
      id: string;
      is_active: boolean;
    }>
  >("staff_add_admin_account", {
    input_display_name: input.displayName || null,
    input_email: input.email,
    input_password: input.password
  });

  const account = rows[0];

  if (!account) {
    throw new Error("Failed to add admin.");
  }

  return {
    createdAt: account.created_at,
    displayName: account.display_name,
    email: account.email,
    id: account.id,
    isActive: account.is_active
  } satisfies StaffAdminAccountRow;
};
