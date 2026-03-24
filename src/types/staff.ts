export interface ShowcasePostRecord {
  id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  readTime: string;
  publishedAt: string;
  content: string[];
  coverImageUrl?: null | string;
  coverClassName: string;
  pillClassName: string;
  iconKey: string;
  sortOrder: number;
}

export interface PublicExploreCoinOverride {
  launchId: string;
  coinAddress: null | string;
  ticker: null | string;
  isHidden: boolean;
  pinnedSlot: null | number;
}

export interface PublicCreatorOverride {
  profileId: string;
  walletAddress: null | string;
  zoraHandle: null | string;
  lensAccountAddress: null | string;
  isHidden: boolean;
  featuredOrder: null | number;
}

export interface PublicCreatorOfWeekCampaign {
  campaignId: string;
  profileId: string;
  category: string;
  bannerUrl: null | string;
  featuredPriceUsd: number;
  creatorEarningsUsd: number;
  displayName: string;
  username: null | string;
  walletAddress: null | string;
  zoraHandle: null | string;
  avatarUrl: null | string;
}

export interface StaffDashboard {
  users: {
    blockedUsers: number;
    hiddenUsers: number;
    totalUsers: number;
  };
  launches: {
    hiddenCoins: number;
    launchedCoins: number;
    pinnedCoins: number;
    totalLaunches: number;
  };
  creators: {
    featuredCreators: number;
    hiddenCreators: number;
    trackedCreators: number;
  };
  referrals: {
    referralE1xp: number;
    rewardedReferrals: number;
    totalReferrals: number;
  };
  missions: {
    activeMissions: number;
    totalMissions: number;
  };
  e1xp: {
    manualE1xpIssued: number;
    totalE1xpIssued: number;
  };
  earnings: {
    paymentVolume: number;
    referralCoinRewards: number;
  };
  showcase: {
    publishedPosts: number;
    totalPosts: number;
  };
}

export interface StaffUserRow {
  profileId: string;
  username: null | string;
  displayName: null | string;
  avatarUrl: null | string;
  walletAddress: null | string;
  zoraHandle: null | string;
  createdAt: string;
  launchesCount: number;
  referralsCount: number;
  totalE1xp: number;
  isHidden: boolean;
  isBlocked: boolean;
}

export interface StaffProfileLaunchRow {
  launchId: string;
  ticker: string;
  name: string;
  status: string;
  coinAddress: null | string;
  createdAt: string;
  launchedAt: null | string;
}

export interface StaffCoinLaunchRow {
  launchId: string;
  creatorId: string;
  creatorName: null | string;
  creatorUsername: null | string;
  ticker: string;
  name: string;
  status: string;
  coinAddress: null | string;
  coverImageUrl: null | string;
  createdAt: string;
  launchedAt: null | string;
  isHidden: boolean;
  pinnedSlot: null | number;
}

export interface StaffReferralRow {
  referralEventId: string;
  referrerName: null | string;
  referrerUsername: null | string;
  referredName: null | string;
  referredUsername: null | string;
  referredWallet: null | string;
  status: string;
  rewardE1xp: number;
  referredTradeCount: number;
  joinedAt: null | string;
  rewardedAt: null | string;
}

export interface StaffEarningsRow {
  itemKind: string;
  itemId: string;
  profileName: null | string;
  profileUsername: null | string;
  walletAddress: null | string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface StaffE1xpActivityRow {
  ledgerId: string;
  profileId: string;
  profileName: null | string;
  profileUsername: null | string;
  walletAddress: null | string;
  amount: number;
  source: string;
  description: null | string;
  createdAt: string;
}

export interface StaffMissionRow {
  missionId: string;
  slug: string;
  title: string;
  status: string;
  rewardE1xp: number;
  taskCount: number;
  participantCount: number;
  startsAt: null | string;
  endsAt: null | string;
}

export interface StaffCreatorRow {
  profileId: string;
  displayName: null | string;
  username: null | string;
  walletAddress: null | string;
  avatarUrl: null | string;
  launchesCount: number;
  totalE1xp: number;
  isHidden: boolean;
  featuredOrder: null | number;
}

export interface StaffVerificationRequestRow {
  id: string;
  profileId: string;
  username: null | string;
  displayName: null | string;
  avatarUrl: null | string;
  walletAddress: null | string;
  provider: "instagram" | "other" | "tiktok" | "x" | "youtube";
  claimedHandle: string;
  verificationCode: string;
  category: null | string;
  note: null | string;
  adminNote: null | string;
  status: "flagged" | "pending" | "rejected" | "unverified" | "verified";
  proofStatus: "failed" | "not_started" | "submitted" | "verified";
  proofPostUrl: null | string;
  proofPostId: null | string;
  proofPostedText: null | string;
  proofHandle: null | string;
  proofError: null | string;
  proofCheckedAt: null | string;
  proofVerifiedAt: null | string;
  createdAt: string;
  reviewedAt: null | string;
  reviewedByAdminName: null | string;
}

export interface StaffCommunityVerificationRequestRow {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  communityAvatarUrl: null | string;
  requestedByProfileId: string;
  requestedByUsername: null | string;
  requestedByDisplayName: null | string;
  verificationKind: "community_led" | "official";
  verificationCode: string;
  category: null | string;
  groupPlatform: null | "other" | "telegram" | "whatsapp";
  groupUrl: null | string;
  note: null | string;
  adminNote: null | string;
  status: "flagged" | "pending" | "rejected" | "unverified" | "verified";
  requiredAdminCount: number;
  confirmedAdminCount: number;
  createdAt: string;
  reviewedAt: null | string;
  reviewedByAdminName: null | string;
}

export interface StaffCreatorOfWeekCampaignRow {
  id: string;
  profileId: string;
  displayName: string;
  username: null | string;
  walletAddress: null | string;
  avatarUrl: null | string;
  category: string;
  bannerUrl: null | string;
  featuredPriceUsd: number;
  creatorEarningsUsd: number;
  note: null | string;
  isActive: boolean;
  startsAt: null | string;
  endsAt: null | string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffSpecialEventCampaignRow {
  id: string;
  title: string;
  body: string;
  bannerUrl: null | string;
  eventTag: null | string;
  ctaLabel: null | string;
  ctaUrl: null | string;
  deliveryKind: "notification" | "popup";
  priority: number;
  isActive: boolean;
  startsAt: null | string;
  endsAt: null | string;
  triggeredAt: null | string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffShowcasePostRow {
  id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  readTime: string;
  publishedAt: string;
  content: string[];
  coverImageUrl: null | string;
  coverClassName: string;
  pillClassName: string;
  iconKey: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface StaffAdminAccountRow {
  id: string;
  email: string;
  displayName: null | string;
  isActive: boolean;
  createdAt: string;
}

export interface StaffAdminSession {
  adminId: string;
  displayName: null | string;
  email: string;
  sessionToken: string;
}

export interface StaffMutationResult {
  deleted?: boolean;
  deliveredCount?: number;
  deliveryKind?: null | string;
  id?: string;
  isBlocked?: boolean;
  isHidden?: boolean;
  isActive?: boolean;
  isPublished?: boolean;
  launchId?: string;
  ledgerId?: string;
  note?: null | string;
  notificationId?: null | string;
  pinnedSlot?: null | number;
  profileId?: string;
  amount?: number;
  category?: null | string;
  featuredOrder?: null | number;
  slug?: string;
  title?: string;
  triggeredAt?: null | string;
}
