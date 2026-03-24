import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  UsersIcon
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useSearchParams } from "react-router";
import { TrendingCoinsCard } from "@/components/Search/Coins";
import { Card, ErrorMessage, H5, Image, Tabs } from "@/components/Shared/UI";
import { listProfileCommunities } from "@/helpers/every1";
import { getPublicProfilePath } from "@/helpers/getAccount";
import {
  type FeaturedCreatorEntry,
  fetchFeaturedCreatorEntries,
  formatCompactMetric,
  formatDelta,
  formatUsdMetric,
  getCreatorTicker,
  isPositiveDelta
} from "@/helpers/liveCreatorData";

const SectionHeader = ({
  title,
  subtitle
}: {
  subtitle: string;
  title: string;
}) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      <H5 className="font-semibold text-[15px] text-gray-900 md:text-[18px] dark:text-white">
        {title}
      </H5>
      <p className="mt-1 text-[12px] text-gray-500 md:text-[13px] dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  </div>
);

const ShortcutTabs = memo(() => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get("type") || "coins";

  const tabs = [
    {
      name: "Coins",
      suffix: <MagnifyingGlassIcon className="size-3.5" />,
      type: "coins"
    },
    {
      name: "Creators",
      suffix: <UsersIcon className="size-3.5" />,
      type: "creators"
    },
    {
      name: "Communities",
      suffix: <UserGroupIcon className="size-3.5" />,
      type: "communities"
    }
  ];

  return (
    <Tabs
      active={active}
      className="mb-0"
      itemClassName="rounded-xl border border-gray-200/80 bg-white px-2.5 py-1.5 font-medium text-[11px] text-gray-700 md:rounded-2xl md:px-3 md:py-1.75 md:text-[12px] dark:border-gray-800/80 dark:bg-[#090909] dark:text-gray-200"
      layoutId="search_shortcuts"
      mobileScrollable
      setActive={(type) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("type", type);
        setSearchParams(nextParams);
      }}
      tabs={tabs}
    />
  );
});

const CreatorRow = ({ creator }: { creator: FeaturedCreatorEntry }) => {
  const creatorPath = getPublicProfilePath({
    address: creator.address,
    handle: creator.handle
  });
  const positive = isPositiveDelta(creator.marketCapDelta24h);

  if (!creatorPath) {
    return null;
  }

  return (
    <Link to={creatorPath}>
      <Card
        className="rounded-3xl border border-gray-200/80 bg-white p-3.5 transition-colors hover:border-gray-300 dark:border-gray-800/80 dark:bg-[#090909] dark:hover:border-gray-700"
        forceRounded
      >
        <div className="flex items-center gap-3">
          <Image
            alt={creator.name}
            className="size-12 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
            height={48}
            src={creator.avatar}
            width={48}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-[15px] text-gray-900 dark:text-white">
                {creator.name}
              </p>
              {creator.symbol ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  {getCreatorTicker(creator.symbol)}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
              <span className="truncate">{creator.handle}</span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span>{formatUsdMetric(creator.marketCap)} MC</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold text-[14px] text-gray-900 dark:text-white">
              {formatUsdMetric(creator.volume24h)}
            </p>
            <p
              className={`mt-1 font-semibold text-[12px] ${
                positive ? "text-[#12c46b]" : "text-rose-500"
              }`}
            >
              {formatDelta(creator.marketCapDelta24h)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
};

const SearchLanding = () => {
  const creatorsQuery = useQuery({
    queryFn: async () => await fetchFeaturedCreatorEntries(3),
    queryKey: ["search-trending-creators"],
    staleTime: 60_000
  });
  const communitiesQuery = useQuery({
    queryFn: async () =>
      await listProfileCommunities({
        feedType: "discover",
        limit: 3
      }),
    queryKey: ["search-trending-communities"],
    staleTime: 60_000
  });

  return (
    <div className="space-y-6">
      <ShortcutTabs />

      <section className="space-y-3">
        <SectionHeader
          subtitle="Live coin discovery across Every1 and Zora."
          title="Trending Coins"
        />
        <TrendingCoinsCard />
      </section>

      <section className="space-y-3">
        <SectionHeader
          subtitle="Creator coins getting attention right now."
          title="Trending Creators"
        />
        {creatorsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-white/5"
                key={`search-trending-creator-${index}`}
              />
            ))}
          </div>
        ) : creatorsQuery.error ? (
          <ErrorMessage
            error={creatorsQuery.error}
            title="Failed to load trending creators"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {creatorsQuery.data?.map((creator) => (
              <CreatorRow creator={creator} key={creator.address} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          subtitle="Public communities worth jumping into."
          title="Communities to Join"
        />
        {communitiesQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="h-28 animate-pulse rounded-3xl bg-gray-100 dark:bg-white/5"
                key={`search-community-${index}`}
              />
            ))}
          </div>
        ) : communitiesQuery.error ? (
          <ErrorMessage
            error={communitiesQuery.error}
            title="Failed to load communities"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {communitiesQuery.data?.map((community) => (
              <Link key={community.id} to={`/g/${community.slug}`}>
                <Card
                  className="rounded-3xl border border-gray-200/80 bg-white p-4 transition-colors hover:border-gray-300 dark:border-gray-800/80 dark:bg-[#090909] dark:hover:border-gray-700"
                  forceRounded
                >
                  <div className="flex items-start gap-3">
                    <Image
                      alt={community.name}
                      className="size-12 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
                      height={48}
                      src={
                        community.avatarUrl ||
                        community.bannerUrl ||
                        "/evlogo.jpg"
                      }
                      width={48}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[15px] text-gray-900 dark:text-white">
                        {community.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-gray-500 dark:text-gray-400">
                        {community.description ||
                          "Join the conversation around creators, holders, and missions."}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                        <span>
                          {formatCompactMetric(community.memberCount)} members
                        </span>
                        <span className="text-gray-300 dark:text-gray-700">
                          •
                        </span>
                        <span>
                          {formatCompactMetric(community.postCount)} posts
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default memo(SearchLanding);
