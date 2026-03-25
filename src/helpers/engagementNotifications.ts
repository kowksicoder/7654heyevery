import type { Every1Notification, Every1Profile } from "@/types/every1";

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const formatNaira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);

const pick = <T,>(items: T[], rand: () => number) =>
  items[Math.floor(rand() * items.length)] || items[0];

const buildAmount = (rand: () => number, values: number[]) =>
  pick(values, rand);

const buildEngagementNotifications = (
  profile?: Every1Profile | null
): Every1Notification[] => {
  const seed = `${profile?.id ?? "guest"}-${new Date()
    .toISOString()
    .slice(0, 10)}`;
  const rand = mulberry32(hashString(seed));
  const now = Date.now();

  const handles = ["@janedoe", "@zara", "@tunde", "@debsoon", "@newhere"];
  const fanHandle = pick(handles, rand);
  const supporterHandle = pick(handles, rand);
  const smallAmount = buildAmount(rand, [500, 2500, 5000, 7500]);
  const mediumAmount = buildAmount(rand, [50000, 75000, 120000]);
  const largeAmount = buildAmount(rand, [325000, 450000, 678000]);
  const fanCount = buildAmount(rand, [50, 72, 124, 125]);
  const supporterCount = buildAmount(rand, [3, 5, 7, 9]);
  const joinCount = buildAmount(rand, [245, 640, 1245]);

  const items: Array<Omit<Every1Notification, "createdAt" | "id">> = [
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: null,
      data: { localOnly: true },
      isRead: true,
      kind: "reward",
      targetKey: null,
      title: `Congratulations, you earned ${formatNaira(smallAmount)} today!`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: null,
      data: { localOnly: true },
      isRead: true,
      kind: "reward",
      targetKey: null,
      title: `Congratulations, your coin earned ${formatNaira(mediumAmount)} this week!`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: fanHandle,
      actorId: null,
      actorUsername: fanHandle,
      body: null,
      data: { localOnly: true },
      isRead: true,
      kind: "reward",
      targetKey: null,
      title: `${fanHandle} earned ${formatNaira(mediumAmount)} this week!`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: fanHandle,
      actorId: null,
      actorUsername: fanHandle,
      body: `${fanCount} new fans joined today.`,
      data: { localOnly: true },
      isRead: true,
      kind: "reward",
      targetKey: null,
      title: `${fanHandle} earned ${formatNaira(smallAmount)} today, +${fanCount} new fans!`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: null,
      data: { localOnly: true },
      isRead: true,
      kind: "reward",
      targetKey: null,
      title: `You earned ${formatNaira(largeAmount)} this week.`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: `+${supporterCount} supporters · ${formatNaira(smallAmount)} volume`,
      data: { localOnly: true },
      isRead: true,
      kind: "system",
      targetKey: null,
      title: `You have ${supporterCount} supporters already`
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: "Invite 1 friend",
      data: { localOnly: true },
      isRead: true,
      kind: "referral",
      targetKey: null,
      title: "🔥 You’re just 1 invite away from rewards"
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: "@Zara",
      actorId: null,
      actorUsername: "@Zara",
      body: "You’re now #18",
      data: { localOnly: true },
      isRead: true,
      kind: "referral",
      targetKey: null,
      title: "@Zara joined using your link 🎉"
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: "+50 users in last hour · Boost it now?",
      data: { localOnly: true },
      isRead: true,
      kind: "nudge",
      targetKey: null,
      title: "🔥 Your FanDrop is trending"
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: "Top 10 get bonus rewards",
      data: { localOnly: true },
      isRead: true,
      kind: "nudge",
      targetKey: null,
      title: "You dropped to #12 😬"
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: null,
      actorId: null,
      actorUsername: null,
      body: `${joinCount.toLocaleString("en-NG")} people joined this FanDrop`,
      data: { localOnly: true },
      isRead: true,
      kind: "mission",
      targetKey: null,
      title: "⏱️ Ends in 2 hours"
    },
    {
      actorAvatarUrl: null,
      actorDisplayName: supporterHandle,
      actorId: null,
      actorUsername: supporterHandle,
      body: "2 new users joined",
      data: { localOnly: true },
      isRead: true,
      kind: "payment",
      targetKey: null,
      title: `${supporterHandle} just supported you with ${formatNaira(500)}`
    }
  ];

  return items.map((item, index) => ({
    ...item,
    createdAt: new Date(now - index * 2 * 60 * 1000).toISOString(),
    id: `local-engagement-${seed}-${index + 1}`
  }));
};

export default buildEngagementNotifications;
