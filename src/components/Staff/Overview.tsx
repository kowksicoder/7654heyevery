import {
  BanknotesIcon,
  FireIcon,
  GiftIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PlusIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon,
  UsersIcon
} from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import BackButton from "@/components/Shared/BackButton";
import Loader from "@/components/Shared/Loader";
import {
  Button,
  Card,
  ErrorMessage,
  Image,
  Input,
  Modal,
  TextArea,
  Toggle
} from "@/components/Shared/UI";
import { DEFAULT_AVATAR } from "@/data/constants";
import cn from "@/helpers/cn";
import formatAddress from "@/helpers/formatAddress";
import nFormatter from "@/helpers/nFormatter";
import {
  getPublicExploreCoinOverrides,
  getStaffDashboard,
  listStaffAdminAccounts,
  listStaffCoinLaunches,
  listStaffCommunityVerificationRequests,
  listStaffCreatorOfWeekCampaigns,
  listStaffCreators,
  listStaffE1xpActivity,
  listStaffEarnings,
  listStaffMissions,
  listStaffProfileLaunches,
  listStaffReferrals,
  listStaffShowcasePosts,
  listStaffSpecialEventCampaigns,
  listStaffUsers,
  listStaffVerificationRequests,
  PUBLIC_CREATOR_OF_WEEK_QUERY_KEY,
  PUBLIC_CREATOR_OVERRIDES_QUERY_KEY,
  PUBLIC_EXPLORE_OVERRIDES_QUERY_KEY,
  PUBLIC_SHOWCASE_QUERY_KEY,
  STAFF_ADMIN_ACCOUNTS_QUERY_KEY,
  STAFF_COIN_LAUNCHES_QUERY_KEY,
  STAFF_COMMUNITY_VERIFICATION_REQUESTS_QUERY_KEY,
  STAFF_CREATOR_OF_WEEK_QUERY_KEY,
  STAFF_CREATORS_QUERY_KEY,
  STAFF_DASHBOARD_QUERY_KEY,
  STAFF_E1XP_ACTIVITY_QUERY_KEY,
  STAFF_EARNINGS_QUERY_KEY,
  STAFF_MISSIONS_QUERY_KEY,
  STAFF_PROFILE_LAUNCHES_QUERY_KEY,
  STAFF_REFERRALS_QUERY_KEY,
  STAFF_SHOWCASE_QUERY_KEY,
  STAFF_SPECIAL_EVENTS_QUERY_KEY,
  STAFF_USERS_QUERY_KEY,
  STAFF_VERIFICATION_REQUESTS_QUERY_KEY,
  staffAddAdminAccount,
  staffDeleteCreatorOfWeekCampaign,
  staffDeleteProfile,
  staffDeleteShowcasePost,
  staffDeleteSpecialEventCampaign,
  staffGrantE1xp,
  staffReviewCommunityVerificationRequest,
  staffReviewVerificationRequest,
  staffSetCoinLaunchOverride,
  staffSetCreatorOverride,
  staffSetProfileModeration,
  staffTriggerSpecialEventCampaign,
  staffUpsertCreatorOfWeekCampaign,
  staffUpsertExternalProfile,
  staffUpsertShowcasePost,
  staffUpsertSpecialEventCampaign
} from "@/helpers/staff";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import useStaffAdminStore from "@/store/persisted/useStaffAdminStore";
import type {
  StaffCoinLaunchRow,
  StaffCommunityVerificationRequestRow,
  StaffCreatorOfWeekCampaignRow,
  StaffCreatorRow,
  StaffShowcasePostRow,
  StaffSpecialEventCampaignRow,
  StaffUserRow,
  StaffVerificationRequestRow
} from "@/types/staff";

type AdminSection =
  | "overview"
  | "users"
  | "coins"
  | "verification"
  | "creators"
  | "events"
  | "referrals"
  | "earnings"
  | "e1xp"
  | "missions"
  | "showcase";

type ShowcaseFormState = {
  category: string;
  content: string;
  coverImageUrl: string;
  description: string;
  id: null | string;
  isPublished: boolean;
  publishedAt: string;
  readTime: string;
  slug: string;
  sortOrder: number;
  title: string;
};

type AdminAccountFormState = {
  displayName: string;
  email: string;
  password: string;
};

type CreatorOfWeekFormState = {
  bannerUrl: string;
  category: string;
  creatorEarningsUsd: string;
  creatorLabel: string;
  featuredPriceUsd: string;
  id: null | string;
  isActive: boolean;
  note: string;
  profileId: string;
  startsAt: string;
  endsAt: string;
};

type SpecialEventFormState = {
  bannerUrl: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  deliveryKind: "notification" | "popup";
  endsAt: string;
  eventTag: string;
  id: null | string;
  isActive: boolean;
  priority: string;
  startsAt: string;
  title: string;
};

const sectionItems: {
  icon: typeof ShieldCheckIcon;
  key: AdminSection;
  label: string;
}[] = [
  { icon: ShieldCheckIcon, key: "overview", label: "Dashboard" },
  { icon: UsersIcon, key: "users", label: "Users" },
  { icon: RocketLaunchIcon, key: "coins", label: "Coins" },
  { icon: ShieldCheckIcon, key: "verification", label: "Verification" },
  { icon: StarIcon, key: "creators", label: "Creators" },
  { icon: MegaphoneIcon, key: "events", label: "Events" },
  { icon: GiftIcon, key: "referrals", label: "Referrals" },
  { icon: BanknotesIcon, key: "earnings", label: "Earnings" },
  { icon: SparklesIcon, key: "e1xp", label: "E1XP" },
  { icon: FireIcon, key: "missions", label: "Missions" },
  { icon: NewspaperIcon, key: "showcase", label: "Showcase" }
];

const showcaseStylePresets: Record<
  string,
  { coverClassName: string; iconKey: string; pillClassName: string }
> = {
  Community: {
    coverClassName:
      "bg-[radial-gradient(circle_at_16%_76%,rgba(255,255,255,0.22),transparent_26%),linear-gradient(135deg,#3f2d20_0%,#a16207_42%,#f59e0b_100%)]",
    iconKey: "user-group",
    pillClassName:
      "bg-white/16 text-white ring-1 ring-white/25 backdrop-blur dark:bg-white/16"
  },
  Creators: {
    coverClassName:
      "bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.26),transparent_24%),linear-gradient(140deg,#172554_0%,#1d4ed8_48%,#60a5fa_100%)]",
    iconKey: "sparkles",
    pillClassName:
      "bg-white/14 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/14"
  },
  Product: {
    coverClassName:
      "bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_36%,#059669_100%)]",
    iconKey: "device-phone-mobile",
    pillClassName:
      "bg-white/12 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/12"
  }
};

const createEmptyShowcaseForm = (): ShowcaseFormState => ({
  category: "Product",
  content: "",
  coverImageUrl: "",
  description: "",
  id: null,
  isPublished: true,
  publishedAt: dayjs().format("YYYY-MM-DD"),
  readTime: "3 min read",
  slug: "",
  sortOrder: 0,
  title: ""
});

const createEmptyAdminAccountForm = (): AdminAccountFormState => ({
  displayName: "",
  email: "",
  password: ""
});

const createEmptyCreatorOfWeekForm = (): CreatorOfWeekFormState => ({
  bannerUrl: "",
  category: "Creators",
  creatorEarningsUsd: "0",
  creatorLabel: "",
  endsAt: "",
  featuredPriceUsd: "0",
  id: null,
  isActive: true,
  note: "",
  profileId: "",
  startsAt: ""
});

const createEmptySpecialEventForm = (): SpecialEventFormState => ({
  bannerUrl: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  deliveryKind: "popup",
  endsAt: "",
  eventTag: "",
  id: null,
  isActive: true,
  priority: "10",
  startsAt: "",
  title: ""
});

const formatDate = (value?: null | string) =>
  value ? dayjs(value).format("D MMM YYYY") : "--";

const formatDateTime = (value?: null | string) =>
  value ? dayjs(value).format("D MMM YYYY, HH:mm") : "--";

const formatDateTimeInput = (value?: null | string) =>
  value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";

const formatMoney = (amount?: number, currency?: null | string) => {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;

  if (!currency || currency.toUpperCase() === "USD") {
    return `$${nFormatter(safeAmount, 2)}`;
  }

  return `${nFormatter(safeAmount, 2)} ${currency}`;
};

const getProfileLabel = (
  name?: null | string,
  username?: null | string,
  wallet?: null | string
) => name || username || formatAddress(wallet || "", 5) || "Unknown";

const AdminNavButton = ({
  active,
  count,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  count?: number;
  icon: typeof ShieldCheckIcon;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors md:gap-3 md:rounded-2xl md:px-3 md:py-2.5",
      active
        ? "bg-emerald-500 text-white shadow-[0_18px_38px_-24px_rgba(16,185,129,0.85)]"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
    )}
    onClick={onClick}
    type="button"
  >
    <span className="flex items-center gap-2 md:gap-2.5">
      <Icon className="size-4 md:size-4.5" />
      <span className="font-semibold text-xs md:text-sm">{label}</span>
    </span>
    {count !== undefined ? (
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-semibold text-[10px] md:px-2 md:text-[11px]",
          active
            ? "bg-white/15 text-white"
            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"
        )}
      >
        {count > 999 ? "999+" : nFormatter(count, 1)}
      </span>
    ) : null}
  </button>
);

const AdminMetricCard = ({
  accentClassName = "text-emerald-600 dark:text-emerald-300",
  label,
  value
}: {
  accentClassName?: string;
  label: string;
  value: string;
}) => (
  <div className="rounded-[1.05rem] border border-gray-200/75 bg-white p-2.5 md:rounded-[1.35rem] md:p-3 dark:border-gray-800/80 dark:bg-black">
    <p
      className={cn(
        "font-semibold text-[1.35rem] tracking-tight md:text-2xl",
        accentClassName
      )}
    >
      {value}
    </p>
    <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:mt-1 md:text-xs dark:text-gray-400">
      {label}
    </p>
  </div>
);

const AdminPanelCard = ({
  action,
  children,
  description,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
}) => (
  <Card className="p-3 md:p-4" forceRounded>
    <div className="flex flex-col gap-1.5 border-gray-200/70 border-b pb-2.5 md:gap-2 md:pb-3 dark:border-gray-800/75">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[15px] text-gray-950 md:text-base dark:text-gray-50">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:text-xs dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
    <div className="pt-2.5 md:pt-3">{children}</div>
  </Card>
);

const EmptyPanel = ({ label }: { label: string }) => (
  <div className="rounded-[0.95rem] border border-gray-200/75 border-dashed px-3 py-6 text-center text-gray-500 text-xs md:rounded-[1rem] md:px-4 md:py-8 md:text-sm dark:border-gray-800/75 dark:text-gray-400">
    {label}
  </div>
);

const Overview = () => {
  const queryClient = useQueryClient();
  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { displayName: adminDisplayName, email: adminEmail } =
    useStaffAdminStore();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [coinSearch, setCoinSearch] = useState("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<null | StaffUserRow>(null);
  const [userModeration, setUserModeration] = useState({
    isBlocked: false,
    isHidden: false,
    note: ""
  });
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantDescription, setGrantDescription] = useState(
    "Manual admin E1XP grant"
  );
  const [userForm, setUserForm] = useState({
    displayName: "",
    username: "",
    walletAddress: "",
    zoraHandle: ""
  });
  const [creatorForm, setCreatorForm] = useState({
    displayName: "",
    walletAddress: "",
    zoraHandle: ""
  });
  const [creatorOfWeekForm, setCreatorOfWeekForm] =
    useState<CreatorOfWeekFormState>(createEmptyCreatorOfWeekForm);
  const [specialEventForm, setSpecialEventForm] =
    useState<SpecialEventFormState>(createEmptySpecialEventForm);
  const [showcaseForm, setShowcaseForm] = useState<ShowcaseFormState>(
    createEmptyShowcaseForm
  );
  const [adminAccountForm, setAdminAccountForm] =
    useState<AdminAccountFormState>(createEmptyAdminAccountForm);
  const [verificationAdminNotes, setVerificationAdminNotes] = useState<
    Record<string, string>
  >({});
  const [communityVerificationAdminNotes, setCommunityVerificationAdminNotes] =
    useState<Record<string, string>>({});
  const [isMutating, setIsMutating] = useState(false);

  const adminAccountsQuery = useQuery({
    enabled: hasSupabaseConfig() && activeSection === "overview",
    queryFn: listStaffAdminAccounts,
    queryKey: [STAFF_ADMIN_ACCOUNTS_QUERY_KEY],
    retry: false,
    staleTime: 20_000
  });
  const dashboardQuery = useQuery({
    enabled: hasSupabaseConfig(),
    queryFn: getStaffDashboard,
    queryKey: [STAFF_DASHBOARD_QUERY_KEY],
    retry: false,
    staleTime: 20_000
  });
  const usersQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "users" ||
        activeSection === "overview" ||
        activeSection === "e1xp" ||
        Boolean(selectedUser)),
    queryFn: () => listStaffUsers(userSearch, 40, 0),
    queryKey: [STAFF_USERS_QUERY_KEY, userSearch],
    retry: false,
    staleTime: 15_000
  });
  const userLaunchesQuery = useQuery({
    enabled: hasSupabaseConfig() && Boolean(selectedUser?.profileId),
    queryFn: () => listStaffProfileLaunches(selectedUser?.profileId || ""),
    queryKey: [STAFF_PROFILE_LAUNCHES_QUERY_KEY, selectedUser?.profileId],
    retry: false
  });
  const coinLaunchesQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "coins" || activeSection === "overview"),
    queryFn: () => listStaffCoinLaunches(coinSearch, 50, 0),
    queryKey: [STAFF_COIN_LAUNCHES_QUERY_KEY, coinSearch],
    retry: false,
    staleTime: 15_000
  });
  const referralsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "referrals" || activeSection === "overview"),
    queryFn: () => listStaffReferrals(60, 0),
    queryKey: [STAFF_REFERRALS_QUERY_KEY],
    retry: false
  });
  const earningsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "earnings" || activeSection === "overview"),
    queryFn: () => listStaffEarnings(60, 0),
    queryKey: [STAFF_EARNINGS_QUERY_KEY],
    retry: false
  });
  const e1xpActivityQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "e1xp" || activeSection === "overview"),
    queryFn: () => listStaffE1xpActivity(60, 0),
    queryKey: [STAFF_E1XP_ACTIVITY_QUERY_KEY],
    retry: false
  });
  const missionsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "missions" || activeSection === "overview"),
    queryFn: listStaffMissions,
    queryKey: [STAFF_MISSIONS_QUERY_KEY],
    retry: false
  });
  const showcaseQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "showcase" || activeSection === "overview"),
    queryFn: listStaffShowcasePosts,
    queryKey: [STAFF_SHOWCASE_QUERY_KEY],
    retry: false
  });
  const creatorsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "creators" || activeSection === "overview"),
    queryFn: () => listStaffCreators(creatorSearch, 40, 0),
    queryKey: [STAFF_CREATORS_QUERY_KEY, creatorSearch],
    retry: false
  });
  const verificationRequestsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "verification" || activeSection === "overview"),
    queryFn: () => listStaffVerificationRequests(null, 80, 0),
    queryKey: [STAFF_VERIFICATION_REQUESTS_QUERY_KEY],
    retry: false
  });
  const communityVerificationRequestsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "verification" || activeSection === "overview"),
    queryFn: () => listStaffCommunityVerificationRequests(null, 80, 0),
    queryKey: [STAFF_COMMUNITY_VERIFICATION_REQUESTS_QUERY_KEY],
    retry: false
  });
  const creatorOfWeekQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "creators" || activeSection === "overview"),
    queryFn: listStaffCreatorOfWeekCampaigns,
    queryKey: [STAFF_CREATOR_OF_WEEK_QUERY_KEY],
    retry: false
  });
  const specialEventsQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "events" || activeSection === "overview"),
    queryFn: listStaffSpecialEventCampaigns,
    queryKey: [STAFF_SPECIAL_EVENTS_QUERY_KEY],
    retry: false
  });
  const publicExploreOverridesQuery = useQuery({
    enabled:
      hasSupabaseConfig() &&
      (activeSection === "coins" || activeSection === "overview"),
    queryFn: getPublicExploreCoinOverrides,
    queryKey: [PUBLIC_EXPLORE_OVERRIDES_QUERY_KEY],
    retry: false
  });

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    setUserModeration({
      isBlocked: selectedUser.isBlocked,
      isHidden: selectedUser.isHidden,
      note: ""
    });
    setGrantAmount("100");
    setGrantDescription("Manual admin E1XP grant");
  }, [selectedUser]);

  const dashboard = dashboardQuery.data;

  const adminSectionCounts = useMemo(
    () => ({
      coins: dashboard?.launches.totalLaunches,
      creators: dashboard?.creators.trackedCreators,
      e1xp: dashboard?.e1xp.totalE1xpIssued,
      events: specialEventsQuery.data?.filter((campaign) => campaign.isActive)
        .length,
      missions: dashboard?.missions.activeMissions,
      referrals: dashboard?.referrals.totalReferrals,
      showcase: dashboard?.showcase.totalPosts,
      users: dashboard?.users.totalUsers,
      verification:
        (verificationRequestsQuery.data?.filter(
          (request) => request.status === "pending"
        ).length || 0) +
        (communityVerificationRequestsQuery.data?.filter(
          (request) => request.status === "pending"
        ).length || 0)
    }),
    [
      communityVerificationRequestsQuery.data,
      dashboard,
      specialEventsQuery.data,
      verificationRequestsQuery.data
    ]
  );

  const topPinnedLaunches = useMemo(() => {
    const launchMap = new Map(
      (coinLaunchesQuery.data || []).map((launch) => [launch.launchId, launch])
    );

    return (publicExploreOverridesQuery.data || [])
      .filter((override) => override.pinnedSlot !== null)
      .sort(
        (a, b) =>
          (a.pinnedSlot || Number.MAX_SAFE_INTEGER) -
          (b.pinnedSlot || Number.MAX_SAFE_INTEGER)
      )
      .map((override) => ({
        launch: launchMap.get(override.launchId),
        pinnedSlot: override.pinnedSlot
      }))
      .filter(
        (item): item is { launch: StaffCoinLaunchRow; pinnedSlot: number } =>
          Boolean(item.launch && item.pinnedSlot)
      );
  }, [coinLaunchesQuery.data, publicExploreOverridesQuery.data]);

  const latestE1xpItems = useMemo(
    () => (e1xpActivityQuery.data || []).slice(0, 5),
    [e1xpActivityQuery.data]
  );
  const currentCreatorOfWeek = useMemo(
    () =>
      (creatorOfWeekQuery.data || []).find((campaign) => campaign.isActive) ||
      null,
    [creatorOfWeekQuery.data]
  );
  const activeSpecialEventPreview = useMemo(
    () =>
      (specialEventsQuery.data || []).find((campaign) => campaign.isActive) ||
      null,
    [specialEventsQuery.data]
  );

  const resetShowcaseForm = () => setShowcaseForm(createEmptyShowcaseForm());

  const invalidateAdminData = async (keys?: string[]) => {
    const defaultKeys = [
      STAFF_ADMIN_ACCOUNTS_QUERY_KEY,
      STAFF_DASHBOARD_QUERY_KEY,
      STAFF_USERS_QUERY_KEY,
      STAFF_COIN_LAUNCHES_QUERY_KEY,
      STAFF_CREATORS_QUERY_KEY,
      STAFF_VERIFICATION_REQUESTS_QUERY_KEY,
      STAFF_COMMUNITY_VERIFICATION_REQUESTS_QUERY_KEY,
      STAFF_CREATOR_OF_WEEK_QUERY_KEY,
      STAFF_SPECIAL_EVENTS_QUERY_KEY,
      STAFF_REFERRALS_QUERY_KEY,
      STAFF_EARNINGS_QUERY_KEY,
      STAFF_E1XP_ACTIVITY_QUERY_KEY,
      STAFF_MISSIONS_QUERY_KEY,
      STAFF_SHOWCASE_QUERY_KEY,
      STAFF_PROFILE_LAUNCHES_QUERY_KEY,
      PUBLIC_EXPLORE_OVERRIDES_QUERY_KEY,
      PUBLIC_CREATOR_OF_WEEK_QUERY_KEY,
      PUBLIC_CREATOR_OVERRIDES_QUERY_KEY,
      PUBLIC_SHOWCASE_QUERY_KEY
    ];

    await Promise.all(
      (keys || defaultKeys).map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    );
  };

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
    invalidateKeys?: string[]
  ) => {
    setIsMutating(true);

    try {
      await action();
      await invalidateAdminData(invalidateKeys);
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error("Admin action failed");
    } finally {
      setIsMutating(false);
    }
  };

  const handleUserCreate = async () => {
    if (!userForm.walletAddress.trim() && !userForm.username.trim()) {
      toast.error("Add at least a wallet or username");
      return;
    }

    await runMutation(
      () =>
        staffUpsertExternalProfile({
          displayName: userForm.displayName,
          username: userForm.username,
          walletAddress: userForm.walletAddress,
          zoraHandle: userForm.zoraHandle
        }),
      "User added",
      [STAFF_USERS_QUERY_KEY, STAFF_DASHBOARD_QUERY_KEY]
    );

    setUserForm({
      displayName: "",
      username: "",
      walletAddress: "",
      zoraHandle: ""
    });
  };

  const handleAdminCreate = async () => {
    if (!adminAccountForm.email.trim() || !adminAccountForm.password.trim()) {
      toast.error("Add an admin email and password");
      return;
    }

    await runMutation(
      () =>
        staffAddAdminAccount({
          displayName: adminAccountForm.displayName,
          email: adminAccountForm.email,
          password: adminAccountForm.password
        }),
      "Admin access updated",
      [STAFF_ADMIN_ACCOUNTS_QUERY_KEY]
    );

    setAdminAccountForm(createEmptyAdminAccountForm());
  };

  const handleCreatorCreate = async () => {
    if (!creatorForm.walletAddress.trim() && !creatorForm.zoraHandle.trim()) {
      toast.error("Add a creator wallet or Zora handle");
      return;
    }

    await runMutation(
      () =>
        staffUpsertExternalProfile({
          displayName: creatorForm.displayName,
          walletAddress: creatorForm.walletAddress,
          zoraHandle: creatorForm.zoraHandle
        }),
      "Creator added",
      [
        STAFF_CREATORS_QUERY_KEY,
        STAFF_USERS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );

    setCreatorForm({ displayName: "", walletAddress: "", zoraHandle: "" });
  };

  const handleUseCreatorForWeek = (creator: StaffCreatorRow) => {
    setCreatorOfWeekForm((prev) => ({
      ...prev,
      creatorLabel: getProfileLabel(
        creator.displayName,
        creator.username,
        creator.walletAddress
      ),
      profileId: creator.profileId
    }));
  };

  const handleCreatorOfWeekSubmit = async () => {
    if (!creatorOfWeekForm.profileId) {
      toast.error("Choose a creator first");
      return;
    }

    const featuredPriceUsd = Number.parseFloat(
      creatorOfWeekForm.featuredPriceUsd || "0"
    );
    const creatorEarningsUsd = Number.parseFloat(
      creatorOfWeekForm.creatorEarningsUsd || "0"
    );

    if (
      !Number.isFinite(featuredPriceUsd) ||
      !Number.isFinite(creatorEarningsUsd) ||
      featuredPriceUsd < 0 ||
      creatorEarningsUsd < 0
    ) {
      toast.error("Price and earnings must be valid positive numbers");
      return;
    }

    await runMutation(
      () =>
        staffUpsertCreatorOfWeekCampaign({
          bannerUrl: creatorOfWeekForm.bannerUrl,
          category: creatorOfWeekForm.category,
          creatorEarningsUsd,
          endsAt: creatorOfWeekForm.endsAt || null,
          featuredPriceUsd,
          id: creatorOfWeekForm.id,
          isActive: creatorOfWeekForm.isActive,
          note: creatorOfWeekForm.note,
          profileId: creatorOfWeekForm.profileId,
          startsAt: creatorOfWeekForm.startsAt || null
        }),
      creatorOfWeekForm.id
        ? "Creator of the week updated"
        : "Creator of the week created",
      [
        STAFF_CREATOR_OF_WEEK_QUERY_KEY,
        PUBLIC_CREATOR_OF_WEEK_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );

    setCreatorOfWeekForm(createEmptyCreatorOfWeekForm());
  };

  const handleEditCreatorOfWeekCampaign = (
    campaign: StaffCreatorOfWeekCampaignRow
  ) => {
    setCreatorOfWeekForm({
      bannerUrl: campaign.bannerUrl || "",
      category: campaign.category,
      creatorEarningsUsd: String(campaign.creatorEarningsUsd || 0),
      creatorLabel: getProfileLabel(
        campaign.displayName,
        campaign.username,
        campaign.walletAddress
      ),
      endsAt: formatDateTimeInput(campaign.endsAt),
      featuredPriceUsd: String(campaign.featuredPriceUsd || 0),
      id: campaign.id,
      isActive: campaign.isActive,
      note: campaign.note || "",
      profileId: campaign.profileId,
      startsAt: formatDateTimeInput(campaign.startsAt)
    });
    setActiveSection("creators");
  };

  const handleDeleteCreatorOfWeek = async (
    campaign: StaffCreatorOfWeekCampaignRow
  ) => {
    if (
      !window.confirm(
        `Remove Creator of the Week campaign for ${getProfileLabel(
          campaign.displayName,
          campaign.username,
          campaign.walletAddress
        )}?`
      )
    ) {
      return;
    }

    await runMutation(
      () => staffDeleteCreatorOfWeekCampaign(campaign.id),
      "Creator of the week removed",
      [
        STAFF_CREATOR_OF_WEEK_QUERY_KEY,
        PUBLIC_CREATOR_OF_WEEK_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );

    if (creatorOfWeekForm.id === campaign.id) {
      setCreatorOfWeekForm(createEmptyCreatorOfWeekForm());
    }
  };

  const handleToggleCreatorOfWeek = async (
    campaign: StaffCreatorOfWeekCampaignRow
  ) => {
    await runMutation(
      () =>
        staffUpsertCreatorOfWeekCampaign({
          bannerUrl: campaign.bannerUrl,
          category: campaign.category,
          creatorEarningsUsd: campaign.creatorEarningsUsd,
          endsAt: campaign.endsAt,
          featuredPriceUsd: campaign.featuredPriceUsd,
          id: campaign.id,
          isActive: !campaign.isActive,
          note: campaign.note,
          profileId: campaign.profileId,
          startsAt: campaign.startsAt
        }),
      campaign.isActive
        ? "Creator of the week paused"
        : "Creator of the week activated",
      [
        STAFF_CREATOR_OF_WEEK_QUERY_KEY,
        PUBLIC_CREATOR_OF_WEEK_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );
  };

  const handleSpecialEventSubmit = async () => {
    if (!specialEventForm.title.trim() || !specialEventForm.body.trim()) {
      toast.error("Add an event title and body");
      return;
    }

    const priority = Number.parseInt(specialEventForm.priority || "0", 10);

    if (!Number.isFinite(priority)) {
      toast.error("Priority must be a valid number");
      return;
    }

    await runMutation(
      () =>
        staffUpsertSpecialEventCampaign({
          bannerUrl: specialEventForm.bannerUrl,
          body: specialEventForm.body,
          ctaLabel: specialEventForm.ctaLabel,
          ctaUrl: specialEventForm.ctaUrl,
          deliveryKind: specialEventForm.deliveryKind,
          endsAt: specialEventForm.endsAt || null,
          eventTag: specialEventForm.eventTag,
          id: specialEventForm.id,
          isActive: specialEventForm.isActive,
          priority,
          startsAt: specialEventForm.startsAt || null,
          title: specialEventForm.title
        }),
      specialEventForm.id ? "Special event updated" : "Special event created",
      [STAFF_SPECIAL_EVENTS_QUERY_KEY, STAFF_DASHBOARD_QUERY_KEY]
    );

    setSpecialEventForm(createEmptySpecialEventForm());
  };

  const handleEditSpecialEvent = (campaign: StaffSpecialEventCampaignRow) => {
    setSpecialEventForm({
      bannerUrl: campaign.bannerUrl || "",
      body: campaign.body,
      ctaLabel: campaign.ctaLabel || "",
      ctaUrl: campaign.ctaUrl || "",
      deliveryKind: campaign.deliveryKind,
      endsAt: formatDateTimeInput(campaign.endsAt),
      eventTag: campaign.eventTag || "",
      id: campaign.id,
      isActive: campaign.isActive,
      priority: String(campaign.priority),
      startsAt: formatDateTimeInput(campaign.startsAt),
      title: campaign.title
    });
    setActiveSection("events");
  };

  const handleDeleteSpecialEvent = async (
    campaign: StaffSpecialEventCampaignRow
  ) => {
    if (!window.confirm(`Delete special event "${campaign.title}"?`)) {
      return;
    }

    await runMutation(
      () => staffDeleteSpecialEventCampaign(campaign.id),
      "Special event removed",
      [STAFF_SPECIAL_EVENTS_QUERY_KEY, STAFF_DASHBOARD_QUERY_KEY]
    );

    if (specialEventForm.id === campaign.id) {
      setSpecialEventForm(createEmptySpecialEventForm());
    }
  };

  const handleToggleSpecialEvent = async (
    campaign: StaffSpecialEventCampaignRow
  ) => {
    await runMutation(
      () =>
        staffUpsertSpecialEventCampaign({
          bannerUrl: campaign.bannerUrl,
          body: campaign.body,
          ctaLabel: campaign.ctaLabel,
          ctaUrl: campaign.ctaUrl,
          deliveryKind: campaign.deliveryKind,
          endsAt: campaign.endsAt,
          eventTag: campaign.eventTag,
          id: campaign.id,
          isActive: !campaign.isActive,
          priority: campaign.priority,
          startsAt: campaign.startsAt,
          title: campaign.title
        }),
      campaign.isActive ? "Special event paused" : "Special event activated",
      [STAFF_SPECIAL_EVENTS_QUERY_KEY, STAFF_DASHBOARD_QUERY_KEY]
    );
  };

  const handleTriggerSpecialEvent = async (
    campaign: StaffSpecialEventCampaignRow
  ) => {
    await runMutation(
      () => staffTriggerSpecialEventCampaign(campaign.id),
      campaign.deliveryKind === "notification"
        ? "Event notifications sent"
        : "Popup event triggered",
      [STAFF_SPECIAL_EVENTS_QUERY_KEY, STAFF_DASHBOARD_QUERY_KEY]
    );
  };

  const handleSaveUserModeration = async () => {
    if (!selectedUser) {
      return;
    }

    await runMutation(
      () =>
        staffSetProfileModeration({
          isBlocked: userModeration.isBlocked,
          isHidden: userModeration.isHidden,
          note: userModeration.note,
          profileId: selectedUser.profileId,
          updatedByWallet: currentAccount?.address || adminEmail || null
        }),
      "User moderation saved",
      [
        STAFF_USERS_QUERY_KEY,
        STAFF_CREATORS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }

    if (
      !window.confirm(
        `Delete ${getProfileLabel(selectedUser.displayName, selectedUser.username, selectedUser.walletAddress)} and remove their related admin data?`
      )
    ) {
      return;
    }

    await runMutation(
      () => staffDeleteProfile(selectedUser.profileId),
      "User removed",
      [
        STAFF_USERS_QUERY_KEY,
        STAFF_CREATORS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        STAFF_E1XP_ACTIVITY_QUERY_KEY,
        STAFF_REFERRALS_QUERY_KEY
      ]
    );

    setSelectedUser(null);
  };

  const handleDeleteCreator = async (creator: StaffCreatorRow) => {
    const label = getProfileLabel(
      creator.displayName,
      creator.username,
      creator.walletAddress
    );

    if (!window.confirm(`Remove creator ${label}?`)) {
      return;
    }

    await runMutation(
      () => staffDeleteProfile(creator.profileId),
      "Creator removed",
      [
        STAFF_CREATORS_QUERY_KEY,
        STAFF_USERS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_CREATOR_OVERRIDES_QUERY_KEY
      ]
    );

    if (selectedUser?.profileId === creator.profileId) {
      setSelectedUser(null);
    }
  };

  const handleGrantE1xp = async (targetUser?: StaffUserRow | null) => {
    const recipient = targetUser || selectedUser;

    if (!recipient) {
      toast.error("Choose a user first");
      return;
    }

    const amount = Number.parseInt(grantAmount, 10);

    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Enter a valid E1XP amount");
      return;
    }

    await runMutation(
      () =>
        staffGrantE1xp({
          actorProfileId: profile?.id || null,
          amount,
          description: grantDescription,
          metadata: {
            adminWallet: currentAccount?.address || adminEmail || null
          },
          profileId: recipient.profileId,
          sourceKey: `admin-${dayjs().valueOf()}`
        }),
      "E1XP sent",
      [
        STAFF_USERS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        STAFF_E1XP_ACTIVITY_QUERY_KEY,
        STAFF_REFERRALS_QUERY_KEY
      ]
    );
  };

  const handleCoinOverride = async (
    launch: StaffCoinLaunchRow,
    next: { isHidden?: boolean; pinnedSlot?: null | number }
  ) => {
    const isHidden = next.isHidden ?? launch.isHidden;
    const pinnedSlot =
      next.pinnedSlot !== undefined ? next.pinnedSlot : launch.pinnedSlot;

    await runMutation(
      () =>
        staffSetCoinLaunchOverride({
          isHidden,
          launchId: launch.launchId,
          pinnedSlot: isHidden ? null : pinnedSlot,
          updatedByWallet: currentAccount?.address || adminEmail || null
        }),
      "Coin override updated",
      [
        STAFF_COIN_LAUNCHES_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_EXPLORE_OVERRIDES_QUERY_KEY
      ]
    );
  };

  const handleCreatorOverride = async (
    creator: StaffCreatorRow,
    next: { featuredOrder?: null | number; isHidden?: boolean }
  ) => {
    const featuredOrder =
      next.featuredOrder !== undefined
        ? next.featuredOrder
        : creator.featuredOrder;
    const isHidden = next.isHidden ?? creator.isHidden;

    await runMutation(
      () =>
        staffSetCreatorOverride({
          featuredOrder,
          isHidden,
          profileId: creator.profileId,
          updatedByWallet: currentAccount?.address || adminEmail || null
        }),
      "Creator override updated",
      [
        STAFF_CREATORS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_CREATOR_OVERRIDES_QUERY_KEY
      ]
    );
  };

  const handleReviewVerificationRequest = async (
    request: StaffVerificationRequestRow,
    status: "flagged" | "rejected" | "verified"
  ) => {
    await runMutation(
      () =>
        staffReviewVerificationRequest({
          adminNote: verificationAdminNotes[request.id] || null,
          requestId: request.id,
          status
        }),
      status === "verified"
        ? "Official creator approved"
        : status === "flagged"
          ? "Verification request flagged"
          : "Verification request rejected",
      [
        STAFF_VERIFICATION_REQUESTS_QUERY_KEY,
        STAFF_USERS_QUERY_KEY,
        STAFF_CREATORS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY
      ]
    );

    setVerificationAdminNotes((prev) => ({
      ...prev,
      [request.id]: ""
    }));
  };

  const handleReviewCommunityVerificationRequest = async (
    request: StaffCommunityVerificationRequestRow,
    status: "flagged" | "rejected" | "verified"
  ) => {
    await runMutation(
      () =>
        staffReviewCommunityVerificationRequest({
          adminNote: communityVerificationAdminNotes[request.id] || null,
          requestId: request.id,
          status
        }),
      status === "verified"
        ? "Community approved"
        : status === "flagged"
          ? "Community verification flagged"
          : "Community verification rejected",
      [
        STAFF_COMMUNITY_VERIFICATION_REQUESTS_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        STAFF_CREATORS_QUERY_KEY
      ]
    );

    setCommunityVerificationAdminNotes((prev) => ({
      ...prev,
      [request.id]: ""
    }));
  };

  const handleShowcaseSubmit = async () => {
    if (!showcaseForm.slug.trim() || !showcaseForm.title.trim()) {
      toast.error("Title and slug are required");
      return;
    }

    const preset =
      showcaseStylePresets[showcaseForm.category] ||
      showcaseStylePresets.Product;

    const content = showcaseForm.content
      .split(/\n{2,}|\r\n\r\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    await runMutation(
      () =>
        staffUpsertShowcasePost({
          category: showcaseForm.category,
          content,
          coverClassName: preset.coverClassName,
          coverImageUrl: showcaseForm.coverImageUrl,
          description: showcaseForm.description,
          iconKey: preset.iconKey,
          id: showcaseForm.id,
          isPublished: showcaseForm.isPublished,
          pillClassName: preset.pillClassName,
          publishedAt: showcaseForm.publishedAt,
          readTime: showcaseForm.readTime,
          slug: showcaseForm.slug,
          sortOrder: showcaseForm.sortOrder,
          title: showcaseForm.title,
          updatedByProfileId: profile?.id || null
        }),
      showcaseForm.id ? "Showcase post updated" : "Showcase post created",
      [
        STAFF_SHOWCASE_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_SHOWCASE_QUERY_KEY
      ]
    );

    resetShowcaseForm();
  };

  const handleEditShowcasePost = (post: StaffShowcasePostRow) => {
    setShowcaseForm({
      category: post.category,
      content: post.content.join("\n\n"),
      coverImageUrl: post.coverImageUrl || "",
      description: post.description,
      id: post.id,
      isPublished: post.isPublished,
      publishedAt: dayjs(post.publishedAt).format("YYYY-MM-DD"),
      readTime: post.readTime,
      slug: post.slug,
      sortOrder: post.sortOrder,
      title: post.title
    });
    setActiveSection("showcase");
  };

  const handleDeleteShowcasePost = async (post: StaffShowcasePostRow) => {
    if (!window.confirm(`Delete showcase post "${post.title}"?`)) {
      return;
    }

    await runMutation(
      () => staffDeleteShowcasePost(post.id),
      "Showcase post removed",
      [
        STAFF_SHOWCASE_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_SHOWCASE_QUERY_KEY
      ]
    );

    if (showcaseForm.id === post.id) {
      resetShowcaseForm();
    }
  };

  const handleToggleShowcasePublish = async (post: StaffShowcasePostRow) => {
    await runMutation(
      () =>
        staffUpsertShowcasePost({
          category: post.category,
          content: post.content,
          coverClassName: post.coverClassName,
          coverImageUrl: post.coverImageUrl,
          description: post.description,
          iconKey: post.iconKey,
          id: post.id,
          isPublished: !post.isPublished,
          pillClassName: post.pillClassName,
          publishedAt: dayjs(post.publishedAt).format("YYYY-MM-DD"),
          readTime: post.readTime,
          slug: post.slug,
          sortOrder: post.sortOrder,
          title: post.title,
          updatedByProfileId: profile?.id || null
        }),
      post.isPublished
        ? "Showcase post unpublished"
        : "Showcase post published",
      [
        STAFF_SHOWCASE_QUERY_KEY,
        STAFF_DASHBOARD_QUERY_KEY,
        PUBLIC_SHOWCASE_QUERY_KEY
      ]
    );
  };

  const renderOverview = () => {
    if (!dashboard) {
      return null;
    }

    return (
      <div className="space-y-3.5">
        <Card className="overflow-hidden p-3 md:p-5" forceRounded>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-3 md:space-y-4">
              <div>
                <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.22em] dark:text-emerald-300">
                  Control center
                </p>
                <h2 className="mt-1.5 font-semibold text-[1.35rem] text-gray-950 tracking-tight md:mt-2 md:text-[2rem] dark:text-gray-50">
                  Run Every1 from one admin surface
                </h2>
                <p className="mt-1.5 max-w-2xl text-gray-500 text-xs leading-5 md:mt-2 md:text-sm dark:text-gray-400">
                  Monitor users, creator launches, referral rewards, E1XP,
                  missions, and Showcase posts from one responsive panel.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-2.5 xl:grid-cols-4">
                <AdminMetricCard
                  label="Total users"
                  value={nFormatter(dashboard.users.totalUsers, 1)}
                />
                <AdminMetricCard
                  accentClassName="text-sky-600 dark:text-sky-300"
                  label="Live launches"
                  value={nFormatter(dashboard.launches.launchedCoins, 1)}
                />
                <AdminMetricCard
                  accentClassName="text-fuchsia-600 dark:text-fuchsia-300"
                  label="Referral rewards"
                  value={nFormatter(dashboard.referrals.totalReferrals, 1)}
                />
                <AdminMetricCard
                  accentClassName="text-amber-600 dark:text-amber-300"
                  label="E1XP issued"
                  value={nFormatter(dashboard.e1xp.totalE1xpIssued, 1)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
              <div className="rounded-[1.05rem] border border-gray-200/70 bg-gray-50 p-2.5 md:rounded-[1.3rem] md:p-3.5 dark:border-gray-800/75 dark:bg-gray-950">
                <p className="font-semibold text-[13px] text-gray-950 md:text-sm dark:text-gray-50">
                  Payment volume
                </p>
                <p className="mt-1 font-semibold text-[1.3rem] text-emerald-600 md:text-2xl dark:text-emerald-300">
                  {formatMoney(dashboard.earnings.paymentVolume, "USD")}
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-4 md:mt-2 md:text-xs dark:text-gray-400">
                  Captured from successful payments.
                </p>
              </div>
              <div className="rounded-[1.05rem] border border-gray-200/70 bg-gray-50 p-2.5 md:rounded-[1.3rem] md:p-3.5 dark:border-gray-800/75 dark:bg-gray-950">
                <p className="font-semibold text-[13px] text-gray-950 md:text-sm dark:text-gray-50">
                  Referral coin rewards
                </p>
                <p className="mt-1 font-semibold text-[1.3rem] text-fuchsia-600 md:text-2xl dark:text-fuchsia-300">
                  {formatMoney(dashboard.earnings.referralCoinRewards, "USD")}
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-4 md:mt-2 md:text-xs dark:text-gray-400">
                  Total coin bonus value sent to referrers.
                </p>
              </div>
              <div className="rounded-[1.05rem] border border-gray-200/70 bg-gray-50 p-2.5 md:rounded-[1.3rem] md:p-3.5 dark:border-gray-800/75 dark:bg-gray-950">
                <p className="font-semibold text-[13px] text-gray-950 md:text-sm dark:text-gray-50">
                  Hidden users and coins
                </p>
                <p className="mt-1 font-semibold text-[1.3rem] text-gray-950 md:text-2xl dark:text-gray-50">
                  {dashboard.users.hiddenUsers + dashboard.launches.hiddenCoins}
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-4 md:mt-2 md:text-xs dark:text-gray-400">
                  {dashboard.users.hiddenUsers} users /{" "}
                  {dashboard.launches.hiddenCoins} coins
                </p>
              </div>
              <div className="rounded-[1.05rem] border border-gray-200/70 bg-gray-50 p-2.5 md:rounded-[1.3rem] md:p-3.5 dark:border-gray-800/75 dark:bg-gray-950">
                <p className="font-semibold text-[13px] text-gray-950 md:text-sm dark:text-gray-50">
                  Featured creators
                </p>
                <p className="mt-1 font-semibold text-[1.3rem] text-gray-950 md:text-2xl dark:text-gray-50">
                  {dashboard.creators.featuredCreators}
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-4 md:mt-2 md:text-xs dark:text-gray-400">
                  Showcase live: {dashboard.showcase.publishedPosts}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <AdminPanelCard
            description="Current top pinned launches in the public Explore story rail."
            title="Explore top 2"
          >
            {topPinnedLaunches.length ? (
              <div className="space-y-2">
                {topPinnedLaunches.map(({ launch, pinnedSlot }) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                    key={launch.launchId}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        #{pinnedSlot} {launch.name}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {launch.ticker.toUpperCase()} -{" "}
                        {launch.creatorName ||
                          launch.creatorUsername ||
                          "Unknown"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      pinned
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel label="No pinned explore coins yet." />
            )}
          </AdminPanelCard>

          <AdminPanelCard
            description="Fresh E1XP events across the platform."
            title="Latest E1XP activity"
          >
            {latestE1xpItems.length ? (
              <div className="space-y-2">
                {latestE1xpItems.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                    key={item.ledgerId}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {getProfileLabel(
                          item.profileName,
                          item.profileUsername,
                          item.walletAddress
                        )}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {item.description || item.source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600 text-sm dark:text-emerald-300">
                        +{nFormatter(item.amount, 1)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel label="No E1XP activity yet." />
            )}
          </AdminPanelCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <AdminPanelCard
            description="The live creator spotlight currently shown in the desktop sidebar."
            title="Creator of the week"
          >
            {currentCreatorOfWeek ? (
              <div className="space-y-3 rounded-[1rem] border border-gray-200/70 p-3 dark:border-gray-800/75">
                <div className="flex items-center gap-3">
                  <Image
                    alt={currentCreatorOfWeek.displayName}
                    className="size-12 rounded-full object-cover"
                    height={48}
                    src={currentCreatorOfWeek.avatarUrl || DEFAULT_AVATAR}
                    width={48}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {currentCreatorOfWeek.displayName}
                    </p>
                    <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                      {currentCreatorOfWeek.username
                        ? `@${currentCreatorOfWeek.username}`
                        : formatAddress(currentCreatorOfWeek.walletAddress, 6)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {currentCreatorOfWeek.category}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      category
                    </p>
                  </div>
                  <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {formatMoney(
                        currentCreatorOfWeek.featuredPriceUsd,
                        "USD"
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      price
                    </p>
                  </div>
                  <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {formatMoney(
                        currentCreatorOfWeek.creatorEarningsUsd,
                        "USD"
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      earnings
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyPanel label="No creator spotlight is live yet." />
            )}
          </AdminPanelCard>

          <AdminPanelCard
            description="The highest-priority active special event campaign."
            title="Active event"
          >
            {activeSpecialEventPreview ? (
              <div className="space-y-3 rounded-[1rem] border border-gray-200/70 p-3 dark:border-gray-800/75">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 uppercase tracking-[0.14em] dark:bg-gray-900 dark:text-gray-300">
                    {activeSpecialEventPreview.deliveryKind}
                  </span>
                  {activeSpecialEventPreview.eventTag ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {activeSpecialEventPreview.eventTag}
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {activeSpecialEventPreview.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-gray-500 text-xs dark:text-gray-400">
                    {activeSpecialEventPreview.body}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {activeSpecialEventPreview.priority}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      priority
                    </p>
                  </div>
                  <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {activeSpecialEventPreview.triggeredAt
                        ? formatDateTime(activeSpecialEventPreview.triggeredAt)
                        : "--"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      last trigger
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyPanel label="No active event campaign is running." />
            )}
          </AdminPanelCard>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <AdminPanelCard
            description="Only allowlisted admins can sign in to the Every1 staff panel."
            title="Admin access"
          >
            {adminAccountsQuery.isLoading ? (
              <Loader className="py-8" message="Loading admins..." />
            ) : adminAccountsQuery.error ? (
              <ErrorMessage
                error={adminAccountsQuery.error}
                title="Failed to load admin accounts"
              />
            ) : adminAccountsQuery.data?.length ? (
              <div className="space-y-2">
                {adminAccountsQuery.data.map((admin) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                    key={admin.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {admin.displayName || admin.email}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {admin.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {admin.email === adminEmail ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          you
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-semibold text-[10px]",
                          admin.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                        )}
                      >
                        {admin.isActive ? "active" : "inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel label="No admin accounts found yet." />
            )}
          </AdminPanelCard>

          <AdminPanelCard
            description="Add another admin with email/password access to the staff panel."
            title="Add admin"
          >
            <div className="grid gap-2.5">
              <Input
                onChange={(event) =>
                  setAdminAccountForm((prev) => ({
                    ...prev,
                    displayName: event.target.value
                  }))
                }
                placeholder="Display name"
                value={adminAccountForm.displayName}
              />
              <Input
                onChange={(event) =>
                  setAdminAccountForm((prev) => ({
                    ...prev,
                    email: event.target.value
                  }))
                }
                placeholder="Admin email"
                type="email"
                value={adminAccountForm.email}
              />
              <Input
                onChange={(event) =>
                  setAdminAccountForm((prev) => ({
                    ...prev,
                    password: event.target.value
                  }))
                }
                placeholder="Admin password"
                type="password"
                value={adminAccountForm.password}
              />
              <Button
                className="w-full"
                disabled={isMutating}
                onClick={handleAdminCreate}
              >
                <PlusIcon className="size-4" />
                Add admin
              </Button>
            </div>
          </AdminPanelCard>
        </div>
      </div>
    );
  };

  const renderUsers = () => (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <AdminPanelCard
          description="Add a user or seed an external profile so Every1 can track them."
          title="Add user"
        >
          <div className="grid gap-2.5">
            <Input
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  displayName: event.target.value
                }))
              }
              placeholder="Display name"
              value={userForm.displayName}
            />
            <Input
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  username: event.target.value
                }))
              }
              placeholder="Username"
              value={userForm.username}
            />
            <Input
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  walletAddress: event.target.value
                }))
              }
              placeholder="Wallet address"
              value={userForm.walletAddress}
            />
            <Input
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  zoraHandle: event.target.value
                }))
              }
              placeholder="Zora handle"
              value={userForm.zoraHandle}
            />
            <Button
              className="w-full"
              disabled={isMutating}
              onClick={handleUserCreate}
            >
              <PlusIcon className="size-4" />
              Add user
            </Button>
          </div>
        </AdminPanelCard>

        <AdminPanelCard
          action={
            <Input
              className="px-3 py-2 text-sm"
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search users"
              value={userSearch}
            />
          }
          description="Open any user to review their coins, moderation state, referrals, and E1XP."
          title="User list"
        >
          {usersQuery.isLoading ? (
            <Loader className="py-10" message="Loading users..." />
          ) : usersQuery.error ? (
            <ErrorMessage
              error={usersQuery.error}
              title="Failed to load users"
            />
          ) : usersQuery.data?.length ? (
            <div className="space-y-2">
              {usersQuery.data.map((user) => (
                <button
                  className="grid w-full gap-3 rounded-[1.1rem] border border-gray-200/70 px-3 py-3 text-left transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,0.7fr))_auto] dark:border-gray-800/75 dark:hover:bg-gray-950"
                  key={user.profileId}
                  onClick={() => setSelectedUser(user)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      alt={getProfileLabel(
                        user.displayName,
                        user.username,
                        user.walletAddress
                      )}
                      className="size-10 rounded-full object-cover"
                      height={40}
                      src={user.avatarUrl || DEFAULT_AVATAR}
                      width={40}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {getProfileLabel(
                          user.displayName,
                          user.username,
                          user.walletAddress
                        )}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {user.username
                          ? `@${user.username}`
                          : formatAddress(user.walletAddress, 6)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {nFormatter(user.launchesCount, 1)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      coins
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {nFormatter(user.referralsCount, 1)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      referrals
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {nFormatter(user.totalE1xp, 1)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      E1XP
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {user.isHidden ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        hidden
                      </span>
                    ) : null}
                    {user.isBlocked ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-[10px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        blocked
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No users found." />
          )}
        </AdminPanelCard>
      </div>
    </div>
  );

  const renderCoins = () => (
    <div className="space-y-3.5">
      <AdminPanelCard
        description="Current manual top slots in Explore. Hidden coins are removed from the story rail."
        title="Pinned overview"
      >
        {topPinnedLaunches.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {topPinnedLaunches.map(({ launch, pinnedSlot }) => (
              <div
                className="rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                key={launch.launchId}
              >
                <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Top {pinnedSlot} - {launch.name}
                </p>
                <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
                  {launch.ticker.toUpperCase()} -{" "}
                  {launch.creatorName || launch.creatorUsername || "Unknown"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="No pinned Explore coins yet." />
        )}
      </AdminPanelCard>

      <AdminPanelCard
        action={
          <Input
            className="px-3 py-2 text-sm"
            onChange={(event) => setCoinSearch(event.target.value)}
            placeholder="Search coins"
            value={coinSearch}
          />
        }
        description="Hide launches from Explore or pin them into the public top 2."
        title="Coin controls"
      >
        {coinLaunchesQuery.isLoading ? (
          <Loader className="py-10" message="Loading launches..." />
        ) : coinLaunchesQuery.error ? (
          <ErrorMessage
            error={coinLaunchesQuery.error}
            title="Failed to load coin launches"
          />
        ) : coinLaunchesQuery.data?.length ? (
          <div className="space-y-2">
            {coinLaunchesQuery.data.map((launch) => (
              <div
                className="grid gap-3 rounded-[1.1rem] border border-gray-200/70 px-3 py-3 md:grid-cols-[minmax(0,2.1fr)_repeat(2,minmax(0,0.8fr))_auto] dark:border-gray-800/75"
                key={launch.launchId}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {launch.name}
                    </p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      {launch.ticker.toUpperCase()}
                    </span>
                  </div>
                  <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                    {launch.creatorName || launch.creatorUsername || "Unknown"}{" "}
                    -{" "}
                    {launch.coinAddress
                      ? formatAddress(launch.coinAddress, 6)
                      : "Pending address"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {launch.status}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {formatDate(launch.launchedAt || launch.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {launch.pinnedSlot
                      ? `Top ${launch.pinnedSlot}`
                      : "Not pinned"}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {launch.isHidden ? "hidden" : "visible"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Button
                    disabled={isMutating}
                    onClick={() =>
                      handleCoinOverride(launch, {
                        isHidden: !launch.isHidden,
                        pinnedSlot: launch.isHidden ? launch.pinnedSlot : null
                      })
                    }
                    outline
                    size="sm"
                  >
                    {launch.isHidden ? "Show" : "Hide"}
                  </Button>
                  <Button
                    disabled={isMutating}
                    onClick={() =>
                      handleCoinOverride(launch, {
                        isHidden: false,
                        pinnedSlot: launch.pinnedSlot === 1 ? null : 1
                      })
                    }
                    outline
                    size="sm"
                  >
                    Top 1
                  </Button>
                  <Button
                    disabled={isMutating}
                    onClick={() =>
                      handleCoinOverride(launch, {
                        isHidden: false,
                        pinnedSlot: launch.pinnedSlot === 2 ? null : 2
                      })
                    }
                    outline
                    size="sm"
                  >
                    Top 2
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="No coin launches found." />
        )}
      </AdminPanelCard>
    </div>
  );

  const renderCreators = () => (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <AdminPanelCard
          description="Seed a creator profile so it can be featured, pinned, or hidden."
          title="Add creator"
        >
          <div className="grid gap-2.5">
            <Input
              onChange={(event) =>
                setCreatorForm((prev) => ({
                  ...prev,
                  displayName: event.target.value
                }))
              }
              placeholder="Display name"
              value={creatorForm.displayName}
            />
            <Input
              onChange={(event) =>
                setCreatorForm((prev) => ({
                  ...prev,
                  walletAddress: event.target.value
                }))
              }
              placeholder="Wallet address"
              value={creatorForm.walletAddress}
            />
            <Input
              onChange={(event) =>
                setCreatorForm((prev) => ({
                  ...prev,
                  zoraHandle: event.target.value
                }))
              }
              placeholder="Zora handle"
              value={creatorForm.zoraHandle}
            />
            <Button
              className="w-full"
              disabled={isMutating}
              onClick={handleCreatorCreate}
            >
              <PlusIcon className="size-4" />
              Add creator
            </Button>
          </div>
        </AdminPanelCard>

        <AdminPanelCard
          action={
            creatorOfWeekForm.id ? (
              <Button
                disabled={isMutating}
                onClick={() =>
                  setCreatorOfWeekForm(createEmptyCreatorOfWeekForm())
                }
                outline
                size="sm"
              >
                Reset
              </Button>
            ) : undefined
          }
          description="Choose one creator to spotlight in the desktop sidebar with a custom banner, category, price, and earnings."
          title="Creator of the week"
        >
          <div className="grid gap-2.5">
            <Input
              disabled
              placeholder="Select a creator from the list"
              value={creatorOfWeekForm.creatorLabel}
            />
            <Input
              onChange={(event) =>
                setCreatorOfWeekForm((prev) => ({
                  ...prev,
                  category: event.target.value
                }))
              }
              placeholder="Category"
              value={creatorOfWeekForm.category}
            />
            <Input
              onChange={(event) =>
                setCreatorOfWeekForm((prev) => ({
                  ...prev,
                  bannerUrl: event.target.value
                }))
              }
              placeholder="Banner image URL"
              value={creatorOfWeekForm.bannerUrl}
            />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                onChange={(event) =>
                  setCreatorOfWeekForm((prev) => ({
                    ...prev,
                    featuredPriceUsd: event.target.value
                  }))
                }
                placeholder="Price (USD)"
                type="number"
                value={creatorOfWeekForm.featuredPriceUsd}
              />
              <Input
                onChange={(event) =>
                  setCreatorOfWeekForm((prev) => ({
                    ...prev,
                    creatorEarningsUsd: event.target.value
                  }))
                }
                placeholder="Earnings (USD)"
                type="number"
                value={creatorOfWeekForm.creatorEarningsUsd}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                onChange={(event) =>
                  setCreatorOfWeekForm((prev) => ({
                    ...prev,
                    startsAt: event.target.value
                  }))
                }
                placeholder="Starts at"
                type="datetime-local"
                value={creatorOfWeekForm.startsAt}
              />
              <Input
                onChange={(event) =>
                  setCreatorOfWeekForm((prev) => ({
                    ...prev,
                    endsAt: event.target.value
                  }))
                }
                placeholder="Ends at"
                type="datetime-local"
                value={creatorOfWeekForm.endsAt}
              />
            </div>
            <TextArea
              className="min-h-24 px-4 py-3 text-sm"
              onChange={(event) =>
                setCreatorOfWeekForm((prev) => ({
                  ...prev,
                  note: event.target.value
                }))
              }
              placeholder="Internal note"
              value={creatorOfWeekForm.note}
            />
            <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-2.5 dark:border-gray-800/75">
              <div>
                <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Active now
                </p>
                <p className="text-gray-500 text-xs dark:text-gray-400">
                  The active campaign appears in the public sidebar.
                </p>
              </div>
              <Toggle
                on={creatorOfWeekForm.isActive}
                setOn={(value) =>
                  setCreatorOfWeekForm((prev) => ({
                    ...prev,
                    isActive: value
                  }))
                }
              />
            </div>
            <Button
              className="w-full"
              disabled={isMutating}
              onClick={handleCreatorOfWeekSubmit}
            >
              <SparklesIcon className="size-4" />
              {creatorOfWeekForm.id ? "Update spotlight" : "Save spotlight"}
            </Button>
          </div>
        </AdminPanelCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <AdminPanelCard
          description="Current and past Creator of the Week campaigns."
          title="Spotlight campaigns"
        >
          {creatorOfWeekQuery.isLoading ? (
            <Loader
              className="py-10"
              message="Loading spotlight campaigns..."
            />
          ) : creatorOfWeekQuery.error ? (
            <ErrorMessage
              error={creatorOfWeekQuery.error}
              title="Failed to load spotlight campaigns"
            />
          ) : creatorOfWeekQuery.data?.length ? (
            <div className="space-y-2">
              {creatorOfWeekQuery.data.map((campaign) => (
                <div
                  className="space-y-3 rounded-[1.1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                  key={campaign.id}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      alt={campaign.displayName}
                      className="size-10 rounded-full object-cover"
                      height={40}
                      src={campaign.avatarUrl || DEFAULT_AVATAR}
                      width={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.displayName}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {campaign.username
                          ? `@${campaign.username}`
                          : formatAddress(campaign.walletAddress, 6)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold text-[10px]",
                        campaign.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                      )}
                    >
                      {campaign.isActive ? "live" : "paused"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.category}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        category
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatMoney(campaign.featuredPriceUsd, "USD")}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        price
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatMoney(campaign.creatorEarningsUsd, "USD")}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        earnings
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      disabled={isMutating}
                      onClick={() => handleEditCreatorOfWeekCampaign(campaign)}
                      outline
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleToggleCreatorOfWeek(campaign)}
                      outline
                      size="sm"
                    >
                      {campaign.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleDeleteCreatorOfWeek(campaign)}
                      outline
                      size="sm"
                    >
                      <TrashIcon className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No creator spotlight campaigns yet." />
          )}
        </AdminPanelCard>

        <AdminPanelCard
          action={
            <Input
              className="px-3 py-2 text-sm"
              onChange={(event) => setCreatorSearch(event.target.value)}
              placeholder="Search creators"
              value={creatorSearch}
            />
          }
          description="Feature creators into the public ranking surfaces or hide them."
          title="Creator controls"
        >
          {creatorsQuery.isLoading ? (
            <Loader className="py-10" message="Loading creators..." />
          ) : creatorsQuery.error ? (
            <ErrorMessage
              error={creatorsQuery.error}
              title="Failed to load creators"
            />
          ) : creatorsQuery.data?.length ? (
            <div className="space-y-2">
              {creatorsQuery.data.map((creator) => (
                <div
                  className="grid gap-3 rounded-[1.1rem] border border-gray-200/70 px-3 py-3 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,0.8fr))_auto] dark:border-gray-800/75"
                  key={creator.profileId}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      alt={getProfileLabel(
                        creator.displayName,
                        creator.username,
                        creator.walletAddress
                      )}
                      className="size-10 rounded-full object-cover"
                      height={40}
                      src={creator.avatarUrl || DEFAULT_AVATAR}
                      width={40}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {getProfileLabel(
                          creator.displayName,
                          creator.username,
                          creator.walletAddress
                        )}
                      </p>
                      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                        {creator.username
                          ? `@${creator.username}`
                          : formatAddress(creator.walletAddress, 6)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {nFormatter(creator.launchesCount, 1)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      launches
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {creator.featuredOrder
                        ? `#${creator.featuredOrder}`
                        : "--"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      featured slot
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      disabled={isMutating}
                      onClick={() =>
                        handleCreatorOverride(creator, {
                          isHidden: !creator.isHidden
                        })
                      }
                      outline
                      size="sm"
                    >
                      {creator.isHidden ? "Show" : "Hide"}
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() =>
                        handleCreatorOverride(creator, {
                          featuredOrder: creator.featuredOrder === 1 ? null : 1,
                          isHidden: false
                        })
                      }
                      outline
                      size="sm"
                    >
                      Top 1
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() =>
                        handleCreatorOverride(creator, {
                          featuredOrder: creator.featuredOrder === 2 ? null : 2,
                          isHidden: false
                        })
                      }
                      outline
                      size="sm"
                    >
                      Top 2
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleUseCreatorForWeek(creator)}
                      outline
                      size="sm"
                    >
                      Week
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleDeleteCreator(creator)}
                      outline
                      size="sm"
                    >
                      <TrashIcon className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No creators found." />
          )}
        </AdminPanelCard>
      </div>
    </div>
  );

  const renderVerification = () => (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 sm:grid-cols-4">
        <AdminMetricCard
          accentClassName="text-blue-600 dark:text-blue-300"
          label="Pending requests"
          value={nFormatter(
            (verificationRequestsQuery.data || []).filter(
              (request) => request.status === "pending"
            ).length,
            1
          )}
        />
        <AdminMetricCard
          accentClassName="text-emerald-600 dark:text-emerald-300"
          label="Approved requests"
          value={nFormatter(
            (verificationRequestsQuery.data || []).filter(
              (request) => request.status === "verified"
            ).length,
            1
          )}
        />
        <AdminMetricCard
          accentClassName="text-amber-600 dark:text-amber-300"
          label="Flagged requests"
          value={nFormatter(
            (verificationRequestsQuery.data || []).filter(
              (request) => request.status === "flagged"
            ).length,
            1
          )}
        />
        <AdminMetricCard
          accentClassName="text-violet-600 dark:text-violet-300"
          label="Proof verified"
          value={nFormatter(
            (verificationRequestsQuery.data || []).filter(
              (request) => request.proofStatus === "verified"
            ).length,
            1
          )}
        />
      </div>

      <AdminPanelCard
        description="Review official creator claims, approve trusted profiles, or flag suspicious handles."
        title="Verification requests"
      >
        {verificationRequestsQuery.isLoading ? (
          <Loader message="Loading verification requests..." />
        ) : verificationRequestsQuery.error ? (
          <ErrorMessage
            error={verificationRequestsQuery.error}
            title="Failed to load verification requests"
          />
        ) : verificationRequestsQuery.data?.length ? (
          <div className="space-y-3">
            {verificationRequestsQuery.data.map((request) => {
              const statusClassName =
                request.status === "verified"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : request.status === "pending"
                    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/30 dark:text-blue-300"
                    : request.status === "flagged"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300";
              const proofClassName =
                request.proofStatus === "verified"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : request.proofStatus === "submitted"
                    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/30 dark:text-blue-300"
                    : request.proofStatus === "failed"
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/80 dark:bg-red-950/30 dark:text-red-300"
                      : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300";

              return (
                <div
                  className="rounded-[1.15rem] border border-gray-200/75 p-3 dark:border-gray-800/80"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Image
                        alt={
                          getProfileLabel(
                            request.displayName,
                            request.username,
                            request.walletAddress
                          ) || "Verification"
                        }
                        className="size-11 rounded-2xl"
                        src={request.avatarUrl || DEFAULT_AVATAR}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                          {getProfileLabel(
                            request.displayName,
                            request.username,
                            request.walletAddress
                          )}
                        </p>
                        <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                          @{request.claimedHandle} on{" "}
                          {request.provider === "x"
                            ? "X"
                            : request.provider.charAt(0).toUpperCase() +
                              request.provider.slice(1)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          <span>{request.category || "Creator"}</span>
                          <span>{request.verificationCode}</span>
                          <span>{formatDateTime(request.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-semibold text-[11px]",
                        statusClassName
                      )}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-semibold text-[11px]",
                        proofClassName
                      )}
                    >
                      {request.proofStatus === "verified"
                        ? "proof verified"
                        : request.proofStatus === "submitted"
                          ? "proof submitted"
                          : request.proofStatus === "failed"
                            ? "proof failed"
                            : "proof pending"}
                    </span>
                    {request.proofPostUrl ? (
                      <a
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 font-semibold text-[11px] text-gray-600 transition-colors hover:text-gray-950 dark:border-gray-800 dark:text-gray-300 dark:hover:text-gray-50"
                        href={request.proofPostUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        proof post
                      </a>
                    ) : null}
                    {request.proofVerifiedAt ? (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {formatDateTime(request.proofVerifiedAt)}
                      </span>
                    ) : null}
                  </div>

                  {request.note ? (
                    <p className="mt-3 text-gray-600 text-xs leading-5 dark:text-gray-300">
                      {request.note}
                    </p>
                  ) : null}

                  {request.proofError ? (
                    <div className="mt-3 rounded-[0.95rem] border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs leading-5 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
                      {request.proofError}
                    </div>
                  ) : null}

                  {request.proofPostedText ? (
                    <div className="mt-3 rounded-[0.95rem] border border-gray-200/75 bg-gray-50 px-3 py-2 text-gray-600 text-xs leading-5 dark:border-gray-800/75 dark:bg-gray-900 dark:text-gray-300">
                      <p className="font-semibold text-[11px] text-gray-950 dark:text-gray-50">
                        Proof post text
                      </p>
                      <p className="mt-1">{request.proofPostedText}</p>
                    </div>
                  ) : null}

                  {request.adminNote ? (
                    <div className="mt-3 rounded-[0.95rem] bg-gray-50 px-3 py-2 text-gray-600 text-xs dark:bg-gray-900 dark:text-gray-300">
                      Admin note: {request.adminNote}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <TextArea
                      className="min-h-20 px-3 py-2 text-sm"
                      onChange={(event) =>
                        setVerificationAdminNotes((prev) => ({
                          ...prev,
                          [request.id]: event.target.value
                        }))
                      }
                      placeholder="Admin review note"
                      value={verificationAdminNotes[request.id] || ""}
                    />
                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewVerificationRequest(request, "verified")
                        }
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewVerificationRequest(request, "flagged")
                        }
                        outline
                        size="sm"
                      >
                        Flag
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewVerificationRequest(request, "rejected")
                        }
                        outline
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>

                  {request.reviewedAt ? (
                    <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                      Reviewed {formatDateTime(request.reviewedAt)}
                      {request.reviewedByAdminName
                        ? ` by ${request.reviewedByAdminName}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel label="No official profile claims yet." />
        )}
      </AdminPanelCard>

      <AdminPanelCard
        description="Review multi-admin community claims and only approve communities after the required organizers confirm."
        title="Community verification"
      >
        {communityVerificationRequestsQuery.isLoading ? (
          <Loader message="Loading community verification requests..." />
        ) : communityVerificationRequestsQuery.error ? (
          <ErrorMessage
            error={communityVerificationRequestsQuery.error}
            title="Failed to load community verification requests"
          />
        ) : communityVerificationRequestsQuery.data?.length ? (
          <div className="space-y-3">
            {communityVerificationRequestsQuery.data.map((request) => {
              const statusClassName =
                request.status === "verified"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : request.status === "pending"
                    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/30 dark:text-blue-300"
                    : request.status === "flagged"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300";

              return (
                <div
                  className="rounded-[1.15rem] border border-gray-200/75 p-3 dark:border-gray-800/80"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Image
                        alt={request.communityName}
                        className="size-11 rounded-2xl"
                        src={request.communityAvatarUrl || DEFAULT_AVATAR}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                          {request.communityName}
                        </p>
                        <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                          @{request.communitySlug}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          <span>
                            {request.verificationKind === "official"
                              ? "Official"
                              : "Community-led"}
                          </span>
                          <span>{request.verificationCode}</span>
                          <span>
                            {request.confirmedAdminCount}/
                            {request.requiredAdminCount} admins
                          </span>
                          <span>{formatDateTime(request.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-semibold text-[11px]",
                        statusClassName
                      )}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>
                      Requested by{" "}
                      {getProfileLabel(
                        request.requestedByDisplayName,
                        request.requestedByUsername,
                        null
                      )}
                    </span>
                    {request.category ? <span>{request.category}</span> : null}
                    {request.groupPlatform ? (
                      <span className="capitalize">
                        {request.groupPlatform}
                      </span>
                    ) : null}
                    {request.groupUrl ? (
                      <a
                        className="rounded-full border border-gray-200 px-2 py-1 font-semibold text-gray-600 transition-colors hover:text-gray-950 dark:border-gray-800 dark:text-gray-300 dark:hover:text-gray-50"
                        href={request.groupUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        group link
                      </a>
                    ) : null}
                  </div>

                  {request.note ? (
                    <p className="mt-3 text-gray-600 text-xs leading-5 dark:text-gray-300">
                      {request.note}
                    </p>
                  ) : null}

                  {request.adminNote ? (
                    <div className="mt-3 rounded-[0.95rem] bg-gray-50 px-3 py-2 text-gray-600 text-xs dark:bg-gray-900 dark:text-gray-300">
                      Admin note: {request.adminNote}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <TextArea
                      className="min-h-20 px-3 py-2 text-sm"
                      onChange={(event) =>
                        setCommunityVerificationAdminNotes((prev) => ({
                          ...prev,
                          [request.id]: event.target.value
                        }))
                      }
                      placeholder="Admin review note"
                      value={communityVerificationAdminNotes[request.id] || ""}
                    />
                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewCommunityVerificationRequest(
                            request,
                            "verified"
                          )
                        }
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewCommunityVerificationRequest(
                            request,
                            "flagged"
                          )
                        }
                        outline
                        size="sm"
                      >
                        Flag
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() =>
                          handleReviewCommunityVerificationRequest(
                            request,
                            "rejected"
                          )
                        }
                        outline
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>

                  {request.reviewedAt ? (
                    <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                      Reviewed {formatDateTime(request.reviewedAt)}
                      {request.reviewedByAdminName
                        ? ` by ${request.reviewedByAdminName}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel label="No community verification claims yet." />
        )}
      </AdminPanelCard>
    </div>
  );

  const renderEvents = () => (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminPanelCard
          action={
            specialEventForm.id ? (
              <Button
                disabled={isMutating}
                onClick={() =>
                  setSpecialEventForm(createEmptySpecialEventForm())
                }
                outline
                size="sm"
              >
                Reset
              </Button>
            ) : undefined
          }
          description="Create pop-up adverts or in-app notification campaigns for launches, promotions, and special events."
          title="Special event campaign"
        >
          <div className="grid gap-2.5">
            <Input
              onChange={(event) =>
                setSpecialEventForm((prev) => ({
                  ...prev,
                  title: event.target.value
                }))
              }
              placeholder="Event title"
              value={specialEventForm.title}
            />
            <TextArea
              className="min-h-28 px-4 py-3 text-sm"
              onChange={(event) =>
                setSpecialEventForm((prev) => ({
                  ...prev,
                  body: event.target.value
                }))
              }
              placeholder="Event message"
              value={specialEventForm.body}
            />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    eventTag: event.target.value
                  }))
                }
                placeholder="Tag (optional)"
                value={specialEventForm.eventTag}
              />
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    priority: event.target.value
                  }))
                }
                placeholder="Priority"
                type="number"
                value={specialEventForm.priority}
              />
            </div>
            <Input
              onChange={(event) =>
                setSpecialEventForm((prev) => ({
                  ...prev,
                  bannerUrl: event.target.value
                }))
              }
              placeholder="Banner image URL"
              value={specialEventForm.bannerUrl}
            />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    ctaLabel: event.target.value
                  }))
                }
                placeholder="CTA label"
                value={specialEventForm.ctaLabel}
              />
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    ctaUrl: event.target.value
                  }))
                }
                placeholder="CTA URL"
                value={specialEventForm.ctaUrl}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    startsAt: event.target.value
                  }))
                }
                placeholder="Starts at"
                type="datetime-local"
                value={specialEventForm.startsAt}
              />
              <Input
                onChange={(event) =>
                  setSpecialEventForm((prev) => ({
                    ...prev,
                    endsAt: event.target.value
                  }))
                }
                placeholder="Ends at"
                type="datetime-local"
                value={specialEventForm.endsAt}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-gray-200/70 px-3 py-2.5 dark:border-gray-800/75">
                <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Delivery
                </p>
                <div className="mt-2 flex gap-2">
                  {(["popup", "notification"] as const).map((kind) => (
                    <button
                      className={cn(
                        "rounded-full px-3 py-1.5 font-semibold text-xs transition-colors",
                        specialEventForm.deliveryKind === kind
                          ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                      )}
                      key={kind}
                      onClick={() =>
                        setSpecialEventForm((prev) => ({
                          ...prev,
                          deliveryKind: kind
                        }))
                      }
                      type="button"
                    >
                      {kind === "popup" ? "Popup modal" : "Notification"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] border border-gray-200/70 px-3 py-2.5 dark:border-gray-800/75">
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    Active
                  </p>
                  <p className="text-gray-500 text-xs dark:text-gray-400">
                    Trigger only when active.
                  </p>
                </div>
                <Toggle
                  on={specialEventForm.isActive}
                  setOn={(value) =>
                    setSpecialEventForm((prev) => ({
                      ...prev,
                      isActive: value
                    }))
                  }
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={isMutating}
              onClick={handleSpecialEventSubmit}
            >
              <MegaphoneIcon className="size-4" />
              {specialEventForm.id ? "Update campaign" : "Save campaign"}
            </Button>
          </div>
        </AdminPanelCard>

        <AdminPanelCard
          description="Trigger campaigns into user notifications or as an in-app popup modal."
          title="Campaign list"
        >
          {specialEventsQuery.isLoading ? (
            <Loader className="py-10" message="Loading special events..." />
          ) : specialEventsQuery.error ? (
            <ErrorMessage
              error={specialEventsQuery.error}
              title="Failed to load special events"
            />
          ) : specialEventsQuery.data?.length ? (
            <div className="space-y-2">
              {specialEventsQuery.data.map((campaign) => (
                <div
                  className="space-y-3 rounded-[1.1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                  key={campaign.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-gray-500 text-xs dark:text-gray-400">
                        {campaign.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        {campaign.deliveryKind === "popup"
                          ? "popup"
                          : "notification"}
                      </span>
                      {campaign.eventTag ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {campaign.eventTag}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.priority}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        priority
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.triggeredAt
                          ? formatDateTime(campaign.triggeredAt)
                          : "--"}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        last trigger
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-gray-50 px-3 py-2 dark:bg-gray-950">
                      <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {campaign.isActive ? "Live" : "Paused"}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        status
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      disabled={isMutating}
                      onClick={() => handleTriggerSpecialEvent(campaign)}
                      size="sm"
                    >
                      Trigger
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleEditSpecialEvent(campaign)}
                      outline
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleToggleSpecialEvent(campaign)}
                      outline
                      size="sm"
                    >
                      {campaign.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => handleDeleteSpecialEvent(campaign)}
                      outline
                      size="sm"
                    >
                      <TrashIcon className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No special event campaigns yet." />
          )}
        </AdminPanelCard>
      </div>
    </div>
  );

  const renderReferrals = () => (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <AdminMetricCard
          accentClassName="text-fuchsia-600 dark:text-fuchsia-300"
          label="Total referrals"
          value={nFormatter(dashboard?.referrals.totalReferrals || 0, 1)}
        />
        <AdminMetricCard
          accentClassName="text-emerald-600 dark:text-emerald-300"
          label="Rewarded referrals"
          value={nFormatter(dashboard?.referrals.rewardedReferrals || 0, 1)}
        />
        <AdminMetricCard
          accentClassName="text-amber-600 dark:text-amber-300"
          label="Referral E1XP"
          value={nFormatter(dashboard?.referrals.referralE1xp || 0, 1)}
        />
      </div>

      <AdminPanelCard
        description="Every join and first-trade reward recorded by the referral engine."
        title="Referral activity"
      >
        {referralsQuery.isLoading ? (
          <Loader className="py-10" message="Loading referral activity..." />
        ) : referralsQuery.error ? (
          <ErrorMessage
            error={referralsQuery.error}
            title="Failed to load referral activity"
          />
        ) : referralsQuery.data?.length ? (
          <div className="space-y-2">
            {referralsQuery.data.map((item) => (
              <div
                className="grid gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))] dark:border-gray-800/75"
                key={item.referralEventId}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {(item.referrerName ||
                      item.referrerUsername ||
                      "Referrer") +
                      " -> " +
                      (item.referredName ||
                        item.referredUsername ||
                        formatAddress(item.referredWallet || "", 5))}
                  </p>
                  <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                    Joined {formatDate(item.joinedAt)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {item.status}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    status
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(item.referredTradeCount, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    trades
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(item.rewardE1xp, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    E1XP
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {formatDate(item.rewardedAt)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    rewarded
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="No referral events yet." />
        )}
      </AdminPanelCard>
    </div>
  );

  const renderEarnings = () => (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <AdminMetricCard
          accentClassName="text-emerald-600 dark:text-emerald-300"
          label="Succeeded payments"
          value={formatMoney(dashboard?.earnings.paymentVolume || 0, "USD")}
        />
        <AdminMetricCard
          accentClassName="text-fuchsia-600 dark:text-fuchsia-300"
          label="Referral coin rewards"
          value={formatMoney(
            dashboard?.earnings.referralCoinRewards || 0,
            "USD"
          )}
        />
      </div>

      <AdminPanelCard
        description="Payments and referral reward lines in one stream."
        title="Earnings ledger"
      >
        {earningsQuery.isLoading ? (
          <Loader className="py-10" message="Loading earnings..." />
        ) : earningsQuery.error ? (
          <ErrorMessage
            error={earningsQuery.error}
            title="Failed to load earnings"
          />
        ) : earningsQuery.data?.length ? (
          <div className="space-y-2">
            {earningsQuery.data.map((item) => (
              <div
                className="grid gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))] dark:border-gray-800/75"
                key={`${item.itemKind}-${item.itemId}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {getProfileLabel(
                      item.profileName,
                      item.profileUsername,
                      item.walletAddress
                    )}
                  </p>
                  <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                    {item.itemKind.replaceAll("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {formatMoney(item.amount, item.currency)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    amount
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {item.status}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    status
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {formatDateTime(item.createdAt)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    created
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="No earnings yet." />
        )}
      </AdminPanelCard>
    </div>
  );

  const renderE1xp = () => (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <AdminPanelCard
          description="Choose a user and manually grant E1XP with an audit note."
          title="Send E1XP"
        >
          <div className="space-y-3">
            <div className="rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75">
              {selectedUser ? (
                <div className="flex items-center gap-3">
                  <Image
                    alt={getProfileLabel(
                      selectedUser.displayName,
                      selectedUser.username,
                      selectedUser.walletAddress
                    )}
                    className="size-10 rounded-full object-cover"
                    height={40}
                    src={selectedUser.avatarUrl || DEFAULT_AVATAR}
                    width={40}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {getProfileLabel(
                        selectedUser.displayName,
                        selectedUser.username,
                        selectedUser.walletAddress
                      )}
                    </p>
                    <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                      {selectedUser.username
                        ? `@${selectedUser.username}`
                        : formatAddress(selectedUser.walletAddress, 6)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm dark:text-gray-400">
                  Pick a user below first.
                </p>
              )}
            </div>

            <Input
              className="px-4 py-3 text-sm"
              onChange={(event) => setGrantAmount(event.target.value)}
              placeholder="Amount"
              value={grantAmount}
            />
            <TextArea
              className="min-h-24 px-4 py-3 text-sm"
              onChange={(event) => setGrantDescription(event.target.value)}
              placeholder="Reason for the grant"
              value={grantDescription}
            />
            <Button
              className="w-full"
              disabled={isMutating || !selectedUser}
              onClick={() => handleGrantE1xp()}
            >
              <SparklesIcon className="size-4" />
              Send E1XP
            </Button>

            <div className="space-y-2 border-gray-200/70 border-t pt-3 dark:border-gray-800/75">
              <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                Quick pick
              </p>
              {usersQuery.data?.slice(0, 6).map((user) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[0.95rem] border px-3 py-2.5 text-left transition-colors",
                    selectedUser?.profileId === user.profileId
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                      : "border-gray-200/70 hover:bg-gray-50 dark:border-gray-800/75 dark:hover:bg-gray-950"
                  )}
                  key={user.profileId}
                  onClick={() => setSelectedUser(user)}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {getProfileLabel(
                        user.displayName,
                        user.username,
                        user.walletAddress
                      )}
                    </p>
                    <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                      {nFormatter(user.totalE1xp, 1)} total E1XP
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    choose
                  </span>
                </button>
              ))}
            </div>
          </div>
        </AdminPanelCard>

        <AdminPanelCard
          description="Live E1XP issuance across the platform."
          title="E1XP activity"
        >
          {e1xpActivityQuery.isLoading ? (
            <Loader className="py-10" message="Loading E1XP activity..." />
          ) : e1xpActivityQuery.error ? (
            <ErrorMessage
              error={e1xpActivityQuery.error}
              title="Failed to load E1XP activity"
            />
          ) : e1xpActivityQuery.data?.length ? (
            <div className="space-y-2">
              {e1xpActivityQuery.data.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                  key={item.ledgerId}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                      {getProfileLabel(
                        item.profileName,
                        item.profileUsername,
                        item.walletAddress
                      )}
                    </p>
                    <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                      {item.description || item.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600 text-sm dark:text-emerald-300">
                      {item.amount > 0 ? "+" : ""}
                      {nFormatter(item.amount, 1)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No E1XP ledger activity yet." />
          )}
        </AdminPanelCard>
      </div>
    </div>
  );

  const renderMissions = () => (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <AdminMetricCard
          accentClassName="text-sky-600 dark:text-sky-300"
          label="Active missions"
          value={nFormatter(dashboard?.missions.activeMissions || 0, 1)}
        />
        <AdminMetricCard
          accentClassName="text-gray-950 dark:text-gray-50"
          label="Total missions"
          value={nFormatter(dashboard?.missions.totalMissions || 0, 1)}
        />
      </div>

      <AdminPanelCard
        description="Track the full mission inventory and how many users have touched each one."
        title="Mission list"
      >
        {missionsQuery.isLoading ? (
          <Loader className="py-10" message="Loading missions..." />
        ) : missionsQuery.error ? (
          <ErrorMessage
            error={missionsQuery.error}
            title="Failed to load missions"
          />
        ) : missionsQuery.data?.length ? (
          <div className="space-y-2">
            {missionsQuery.data.map((mission) => (
              <div
                className="grid gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))] dark:border-gray-800/75"
                key={mission.missionId}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {mission.title}
                  </p>
                  <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                    {mission.slug}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {mission.status}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    status
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(mission.rewardE1xp, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    reward
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(mission.taskCount, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    tasks
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(mission.participantCount, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    participants
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="No missions found." />
        )}
      </AdminPanelCard>
    </div>
  );

  const renderShowcase = () => (
    <div className="space-y-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <AdminPanelCard
          action={
            showcaseForm.id ? (
              <Button onClick={resetShowcaseForm} outline size="sm">
                Reset
              </Button>
            ) : null
          }
          description="Publish or draft public updates for the Every1 Showcase feed."
          title={showcaseForm.id ? "Edit story" : "Create story"}
        >
          <div className="grid gap-2.5">
            <div className="grid gap-2.5 md:grid-cols-2">
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    title: event.target.value
                  }))
                }
                placeholder="Story title"
                value={showcaseForm.title}
              />
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    slug: event.target.value
                  }))
                }
                placeholder="Slug"
                value={showcaseForm.slug}
              />
            </div>

            <div className="grid gap-2.5 md:grid-cols-3">
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    category: event.target.value
                  }))
                }
                placeholder="Category"
                value={showcaseForm.category}
              />
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    readTime: event.target.value
                  }))
                }
                placeholder="Read time"
                value={showcaseForm.readTime}
              />
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    publishedAt: event.target.value
                  }))
                }
                type="date"
                value={showcaseForm.publishedAt}
              />
            </div>

            <Input
              onChange={(event) =>
                setShowcaseForm((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              placeholder="Short story description"
              value={showcaseForm.description}
            />

            <Input
              onChange={(event) =>
                setShowcaseForm((prev) => ({
                  ...prev,
                  coverImageUrl: event.target.value
                }))
              }
              placeholder="Cover image URL"
              value={showcaseForm.coverImageUrl}
            />

            <TextArea
              className="min-h-32 px-4 py-3 text-sm"
              onChange={(event) =>
                setShowcaseForm((prev) => ({
                  ...prev,
                  content: event.target.value
                }))
              }
              placeholder="Story body. Separate paragraphs with a blank line."
              value={showcaseForm.content}
            />

            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <Input
                onChange={(event) =>
                  setShowcaseForm((prev) => ({
                    ...prev,
                    sortOrder:
                      Number.parseInt(event.target.value || "0", 10) || 0
                  }))
                }
                placeholder="Sort order"
                value={String(showcaseForm.sortOrder)}
              />
              <div className="flex items-center gap-2 rounded-[1rem] border border-gray-200/70 px-3 py-2.5 dark:border-gray-800/75">
                <Toggle
                  on={showcaseForm.isPublished}
                  setOn={(value) =>
                    setShowcaseForm((prev) => ({
                      ...prev,
                      isPublished: value
                    }))
                  }
                />
                <span className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Publish now
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={isMutating}
              onClick={handleShowcaseSubmit}
            >
              <MegaphoneIcon className="size-4" />
              {showcaseForm.id ? "Update story" : "Add to Showcase"}
            </Button>
          </div>
        </AdminPanelCard>

        <AdminPanelCard
          description="Manage every journal post already in the public Showcase feed."
          title="Story list"
        >
          {showcaseQuery.isLoading ? (
            <Loader className="py-10" message="Loading stories..." />
          ) : showcaseQuery.error ? (
            <ErrorMessage
              error={showcaseQuery.error}
              title="Failed to load Showcase posts"
            />
          ) : showcaseQuery.data?.length ? (
            <div className="space-y-2">
              {showcaseQuery.data.map((post) => (
                <div
                  className="rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                  key={post.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                          {post.category}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-semibold text-[10px]",
                            post.isPublished
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                          )}
                        >
                          {post.isPublished ? "live" : "draft"}
                        </span>
                      </div>
                      <p className="mt-2 truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {post.title}
                      </p>
                      <p className="mt-1 truncate text-gray-500 text-xs dark:text-gray-400">
                        {post.slug} - {formatDate(post.publishedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        disabled={isMutating}
                        onClick={() => handleEditShowcasePost(post)}
                        outline
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() => handleToggleShowcasePublish(post)}
                        outline
                        size="sm"
                      >
                        {post.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() => handleDeleteShowcasePost(post)}
                        outline
                        size="sm"
                      >
                        <TrashIcon className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label="No Showcase posts yet." />
          )}
        </AdminPanelCard>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "users":
        return renderUsers();
      case "coins":
        return renderCoins();
      case "verification":
        return renderVerification();
      case "creators":
        return renderCreators();
      case "events":
        return renderEvents();
      case "referrals":
        return renderReferrals();
      case "earnings":
        return renderEarnings();
      case "e1xp":
        return renderE1xp();
      case "missions":
        return renderMissions();
      case "showcase":
        return renderShowcase();
      default:
        return renderOverview();
    }
  };

  if (!hasSupabaseConfig()) {
    return (
      <Card className="p-5" forceRounded>
        <h2 className="font-semibold text-gray-950 text-lg dark:text-gray-50">
          Admin panel unavailable
        </h2>
        <p className="mt-2 text-gray-500 text-sm dark:text-gray-400">
          Add the Supabase environment values first so the staff tools can load.
        </p>
      </Card>
    );
  }

  if (dashboardQuery.isLoading && !dashboard) {
    return (
      <Card className="p-8" forceRounded>
        <Loader message="Loading admin tools..." />
      </Card>
    );
  }

  if (dashboardQuery.error && !dashboard) {
    return (
      <Card className="p-5" forceRounded>
        <ErrorMessage
          error={dashboardQuery.error}
          title="Failed to load the admin dashboard"
        />
      </Card>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[92rem] px-3 py-3 md:px-0 md:py-5">
        <div className="grid gap-3 xl:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-4">
          <Card className="hidden h-fit p-3 xl:block" forceRounded>
            <div className="space-y-3">
              <div className="rounded-[1.4rem] bg-gray-50 p-3.5 dark:bg-gray-950">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-500/12 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheckIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                      Every1 Admin
                    </p>
                    <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
                      Logged in as {adminDisplayName || adminEmail || "admin"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {sectionItems.map((item) => (
                  <AdminNavButton
                    active={activeSection === item.key}
                    count={
                      item.key === "users"
                        ? adminSectionCounts.users
                        : item.key === "coins"
                          ? adminSectionCounts.coins
                          : item.key === "verification"
                            ? adminSectionCounts.verification
                            : item.key === "creators"
                              ? adminSectionCounts.creators
                              : item.key === "events"
                                ? adminSectionCounts.events
                                : item.key === "referrals"
                                  ? adminSectionCounts.referrals
                                  : item.key === "e1xp"
                                    ? adminSectionCounts.e1xp
                                    : item.key === "missions"
                                      ? adminSectionCounts.missions
                                      : item.key === "showcase"
                                        ? adminSectionCounts.showcase
                                        : undefined
                    }
                    icon={item.icon}
                    key={item.key}
                    label={item.label}
                    onClick={() => setActiveSection(item.key)}
                  />
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-emerald-200/70 bg-emerald-50 p-3.5 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                <p className="font-semibold text-emerald-700 text-sm dark:text-emerald-300">
                  Admin note
                </p>
                <p className="mt-1 text-emerald-700/80 text-xs leading-5 dark:text-emerald-200/85">
                  Use this panel to manage public surfaces carefully. Coin and
                  creator overrides update live pages.
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-3 md:space-y-4">
            <Card className="p-3 md:p-5" forceRounded>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                <div className="flex items-start gap-2.5 md:gap-3">
                  <BackButton path="/" />
                  <div>
                    <p className="font-semibold text-emerald-600 text-xs uppercase tracking-[0.22em] dark:text-emerald-300">
                      Admin panel
                    </p>
                    <h1 className="mt-1.5 font-semibold text-[1.25rem] text-gray-950 tracking-tight md:mt-2 md:text-[1.85rem] dark:text-gray-50">
                      Monitor Every1 in real time
                    </h1>
                    <p className="mt-1 max-w-3xl text-gray-500 text-xs leading-5 md:text-sm dark:text-gray-400">
                      Stats, users, launches, referrals, E1XP, missions, and
                      Showcase publishing in one responsive workspace.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className="min-w-0 rounded-[0.9rem] border border-gray-200/70 px-2.5 py-2 md:rounded-[1rem] md:px-3 md:py-2.5 dark:border-gray-800/75">
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
                      Admin email
                    </p>
                    <p className="mt-1 truncate font-semibold text-[11px] text-gray-950 md:text-sm dark:text-gray-50">
                      {adminEmail || "--"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-[0.9rem] border border-gray-200/70 px-2.5 py-2 md:rounded-[1rem] md:px-3 md:py-2.5 dark:border-gray-800/75">
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
                      Today
                    </p>
                    <p className="mt-1 truncate font-semibold text-[11px] text-gray-950 md:text-sm dark:text-gray-50">
                      {formatDate(dayjs().toISOString())}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-[0.9rem] border border-gray-200/70 px-2.5 py-2 md:rounded-[1rem] md:px-3 md:py-2.5 dark:border-gray-800/75">
                    <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
                      Showcase live
                    </p>
                    <p className="mt-1 truncate font-semibold text-[11px] text-gray-950 md:text-sm dark:text-gray-50">
                      {nFormatter(dashboard?.showcase.publishedPosts || 0, 1)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-x-auto p-1.5 xl:hidden" forceRounded>
              <div className="flex gap-1.5">
                {sectionItems.map((item) => {
                  const count =
                    item.key === "users"
                      ? adminSectionCounts.users
                      : item.key === "coins"
                        ? adminSectionCounts.coins
                        : item.key === "verification"
                          ? adminSectionCounts.verification
                          : item.key === "creators"
                            ? adminSectionCounts.creators
                            : item.key === "events"
                              ? adminSectionCounts.events
                              : item.key === "referrals"
                                ? adminSectionCounts.referrals
                                : item.key === "e1xp"
                                  ? adminSectionCounts.e1xp
                                  : item.key === "missions"
                                    ? adminSectionCounts.missions
                                    : item.key === "showcase"
                                      ? adminSectionCounts.showcase
                                      : undefined;

                  return (
                    <button
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold text-[11px] transition-colors",
                        activeSection === item.key
                          ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                      )}
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      type="button"
                    >
                      <item.icon className="size-3.5" />
                      <span>{item.label}</span>
                      {count !== undefined ? (
                        <span
                          className={cn(
                            "rounded-full px-1 py-0.5 text-[9px]",
                            activeSection === item.key
                              ? "bg-white/15 text-white dark:bg-gray-950/10 dark:text-gray-950"
                              : "bg-white text-gray-500 dark:bg-black dark:text-gray-300"
                          )}
                        >
                          {count > 999 ? "999+" : nFormatter(count, 1)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Card>

            {renderSection()}
          </div>
        </div>
      </div>

      <Modal
        onClose={() => setSelectedUser(null)}
        show={Boolean(selectedUser)}
        size="lg"
        title="User details"
      >
        {selectedUser ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <Image
                  alt={getProfileLabel(
                    selectedUser.displayName,
                    selectedUser.username,
                    selectedUser.walletAddress
                  )}
                  className="size-14 rounded-full object-cover"
                  height={56}
                  src={selectedUser.avatarUrl || DEFAULT_AVATAR}
                  width={56}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-base text-gray-950 dark:text-gray-50">
                    {getProfileLabel(
                      selectedUser.displayName,
                      selectedUser.username,
                      selectedUser.walletAddress
                    )}
                  </p>
                  <p className="truncate text-gray-500 text-sm dark:text-gray-400">
                    {selectedUser.username
                      ? `@${selectedUser.username}`
                      : formatAddress(selectedUser.walletAddress, 6)}
                  </p>
                  <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
                    Joined {formatDate(selectedUser.createdAt)}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-gray-200/70 px-3 py-2 dark:border-gray-800/75">
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(selectedUser.launchesCount, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    coins
                  </p>
                </div>
                <div className="rounded-[1rem] border border-gray-200/70 px-3 py-2 dark:border-gray-800/75">
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(selectedUser.referralsCount, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    referrals
                  </p>
                </div>
                <div className="rounded-[1rem] border border-gray-200/70 px-3 py-2 dark:border-gray-800/75">
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {nFormatter(selectedUser.totalE1xp, 1)}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    E1XP
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4">
                <Card className="p-4" forceRounded>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-base text-gray-950 dark:text-gray-50">
                        Moderation
                      </h3>
                      <p className="text-gray-500 text-xs dark:text-gray-400">
                        Hide, block, or note moderation actions for this user.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                          Hide user
                        </span>
                        <Toggle
                          on={userModeration.isHidden}
                          setOn={(value) =>
                            setUserModeration((prev) => ({
                              ...prev,
                              isHidden: value
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                          Block user
                        </span>
                        <Toggle
                          on={userModeration.isBlocked}
                          setOn={(value) =>
                            setUserModeration((prev) => ({
                              ...prev,
                              isBlocked: value
                            }))
                          }
                        />
                      </div>
                    </div>

                    <TextArea
                      className="min-h-24 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setUserModeration((prev) => ({
                          ...prev,
                          note: event.target.value
                        }))
                      }
                      placeholder="Internal moderation note"
                      value={userModeration.note}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isMutating}
                        onClick={handleSaveUserModeration}
                        size="sm"
                      >
                        Save moderation
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={handleDeleteUser}
                        outline
                        size="sm"
                      >
                        <TrashIcon className="size-3.5" />
                        Remove user
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4" forceRounded>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-base text-gray-950 dark:text-gray-50">
                        Send E1XP
                      </h3>
                      <p className="text-gray-500 text-xs dark:text-gray-400">
                        Manual reward or correction for this user.
                      </p>
                    </div>

                    <Input
                      className="px-4 py-3 text-sm"
                      onChange={(event) => setGrantAmount(event.target.value)}
                      placeholder="Amount"
                      value={grantAmount}
                    />
                    <TextArea
                      className="min-h-24 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setGrantDescription(event.target.value)
                      }
                      placeholder="Reason for the grant"
                      value={grantDescription}
                    />
                    <Button
                      className="w-full"
                      disabled={isMutating}
                      onClick={() => handleGrantE1xp()}
                    >
                      <SparklesIcon className="size-4" />
                      Send E1XP
                    </Button>
                  </div>
                </Card>
              </div>

              <Card className="p-4" forceRounded>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-base text-gray-950 dark:text-gray-50">
                      Coin list
                    </h3>
                    <p className="text-gray-500 text-xs dark:text-gray-400">
                      Every creator launch tied to this profile.
                    </p>
                  </div>

                  {userLaunchesQuery.isLoading ? (
                    <Loader className="py-10" message="Loading user coins..." />
                  ) : userLaunchesQuery.error ? (
                    <ErrorMessage
                      error={userLaunchesQuery.error}
                      title="Failed to load user coin list"
                    />
                  ) : userLaunchesQuery.data?.length ? (
                    <div className="space-y-2">
                      {userLaunchesQuery.data.map((launch) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-[1rem] border border-gray-200/70 px-3 py-3 dark:border-gray-800/75"
                          key={launch.launchId}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                              {launch.name}
                            </p>
                            <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                              {launch.ticker.toUpperCase()} - {launch.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                              {formatDate(
                                launch.launchedAt || launch.createdAt
                              )}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {launch.coinAddress
                                ? formatAddress(launch.coinAddress, 5)
                                : "Pending"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel label="This user has not created any coins yet." />
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default Overview;
