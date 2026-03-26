import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon, FireIcon } from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import Hero from "@/components/Home/Hero";
import Suggested from "@/components/Home/Suggested";
import DismissRecommendedAccount from "@/components/Shared/Account/DismissRecommendedAccount";
import SingleAccount from "@/components/Shared/Account/SingleAccount";
import SingleAccountShimmer from "@/components/Shared/Shimmer/SingleAccountShimmer";
import Skeleton from "@/components/Shared/Skeleton";
import { Card, ErrorMessage, H6, Image, Modal } from "@/components/Shared/UI";
import { DEFAULT_AVATAR } from "@/data/constants";
import { getPublicProfilePath } from "@/helpers/getAccount";
import {
  type FeaturedCreatorEntry,
  fetchCreatorOfWeekEntry,
  fetchTraderLeaderboardEntries,
  formatCompactMetric,
  formatDelta,
  formatUsdMetric,
  getCreatorTicker,
  isPositiveDelta,
  type TraderLeaderboardEntry
} from "@/helpers/liveCreatorData";
import { PUBLIC_CREATOR_OF_WEEK_QUERY_KEY } from "@/helpers/staff";
import {
  type AccountFragment,
  PageSize,
  useAccountRecommendationsQuery
} from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const RECOMMENDATION_LIMIT = 3;

const Title = memo(({ children }: { children: string }) => (
  <H6 className="text-[12px] text-gray-700 leading-none tracking-tight dark:text-gray-200">
    {children}
  </H6>
));

const CreatorWeekSkeleton = () => (
  <Card className="space-y-3 overflow-hidden p-0">
    <div className="h-20 bg-gray-100 dark:bg-[#101011]" />
    <div className="space-y-2.5 px-3.5 pt-6 pb-3.5">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-4 w-6/12 rounded-full" />
        <Skeleton className="h-2.5 w-4/12 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }, (_, index) => `creator-week-${index}`).map(
          (id) => (
            <Skeleton className="h-10 rounded-xl" key={id} />
          )
        )}
      </div>
    </div>
  </Card>
);

const CreatorOfWeekCard = ({ creator }: { creator: FeaturedCreatorEntry }) => {
  const creatorPath = getPublicProfilePath({
    address: creator.creatorWalletAddress || creator.address,
    handle: creator.handle
  });
  const ticker = getCreatorTicker(creator.symbol);
  const positive = isPositiveDelta(creator.marketCapDelta24h);

  if (!creatorPath) {
    return null;
  }

  return (
    <Link className="block" to={creatorPath}>
      <Card className="group overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5">
        <div className="relative h-20 overflow-hidden bg-gray-100 dark:bg-[#101011]">
          <Image
            alt={creator.name}
            className="h-full w-full scale-110 object-cover opacity-40 transition-transform duration-300 group-hover:scale-[1.14] dark:opacity-30"
            src={creator.bannerUrl || creator.avatar || DEFAULT_AVATAR}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-white dark:via-black/20 dark:to-[#060606]" />
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.75 font-semibold text-[9px] text-gray-700 uppercase tracking-[0.12em] backdrop-blur dark:bg-black/45 dark:text-[#d9d9de]">
              <SparklesIcon className="size-3" />
              Creator of the week
            </div>
            {creator.category ? (
              <span className="rounded-full bg-emerald-500/90 px-1.5 py-0.75 font-semibold text-[9px] text-white uppercase tracking-[0.1em]">
                {creator.category}
              </span>
            ) : null}
          </div>
          <div className="absolute -bottom-4.5 left-3.5">
            <Image
              alt={creator.name}
              className="size-12 rounded-2xl border-2 border-white object-cover shadow-sm ring-1 ring-gray-200 dark:border-[#060606] dark:ring-white/10"
              src={creator.avatar || DEFAULT_AVATAR}
            />
          </div>
        </div>

        <div className="space-y-2.5 px-3.5 pt-5.5 pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-[14px] text-gray-900 dark:text-white">
                {creator.name}
              </p>
              {creator.isOfficial ? (
                <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
              ) : null}
              {ticker ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 font-semibold text-[9px] text-gray-600 dark:bg-[#101011] dark:text-[#cfcfd4]">
                  {ticker}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-[#9e9ea5]">
              {creator.handle}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {typeof creator.featuredPriceUsd === "number"
                  ? formatUsdMetric(creator.featuredPriceUsd)
                  : "--"}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                Price
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {formatUsdMetric(creator.marketCap)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                MC
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {formatCompactMetric(creator.uniqueHolders)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                Holders
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p
                className={`truncate font-semibold text-[12px] tracking-tight ${
                  positive ? "text-[#12c46b]" : "text-rose-500"
                }`}
              >
                {formatDelta(creator.marketCapDelta24h)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                24h
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

const FanOfWeekCard = ({ fan }: { fan: TraderLeaderboardEntry }) => {
  const fanPath = getPublicProfilePath({
    address: fan.address,
    handle: fan.handle
  });

  const content = (
    <Card className="group overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="relative h-20 overflow-hidden bg-gray-100 dark:bg-[#101011]">
        <Image
          alt={fan.displayName}
          className="h-full w-full scale-110 object-cover opacity-40 transition-transform duration-300 group-hover:scale-[1.14] dark:opacity-30"
          src={fan.avatar || DEFAULT_AVATAR}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-white dark:via-black/20 dark:to-[#060606]" />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.75 font-semibold text-[9px] text-gray-700 uppercase tracking-[0.12em] backdrop-blur dark:bg-black/45 dark:text-[#d9d9de]">
            <FireIcon className="size-3" />
            Fan of the week
          </div>
          <span className="rounded-full bg-orange-500/90 px-1.5 py-0.75 font-semibold text-[9px] text-white uppercase tracking-[0.1em]">
            Top trader
          </span>
        </div>
        <div className="absolute -bottom-4.5 left-3.5">
          <Image
            alt={fan.displayName}
            className="size-12 rounded-2xl border-2 border-white object-cover shadow-sm ring-1 ring-gray-200 dark:border-[#060606] dark:ring-white/10"
            src={fan.avatar || DEFAULT_AVATAR}
          />
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 pt-5.5 pb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-[14px] text-gray-900 dark:text-white">
              {fan.displayName}
            </p>
            {fan.isOfficial ? (
              <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-[#9e9ea5]">
            {fan.handle}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
            <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
              {formatUsdMetric(fan.weekVolumeUsd)}
            </p>
            <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
              Earnings
            </p>
          </div>
          <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
            <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
              {formatCompactMetric(fan.weekTradesCount)}
            </p>
            <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
              Trades
            </p>
          </div>
          <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
            <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
              {formatCompactMetric(fan.score)}
            </p>
            <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
              Score
            </p>
          </div>
          <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
            <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
              {formatCompactMetric(fan.e1xpTotal)}
            </p>
            <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
              E1XP
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  if (!fanPath) {
    return content;
  }

  return (
    <Link className="block" to={fanPath}>
      {content}
    </Link>
  );
};

const CreatorWeekSlider = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const { data: creator, isLoading: isCreatorLoading } = useQuery({
    queryFn: async () => await fetchCreatorOfWeekEntry(),
    queryKey: [PUBLIC_CREATOR_OF_WEEK_QUERY_KEY],
    staleTime: 5 * 60 * 1000
  });

  const { data: fan, isLoading: isFanLoading } = useQuery({
    queryFn: async () => {
      try {
        const entries = await fetchTraderLeaderboardEntries(1);
        return entries[0] ?? null;
      } catch {
        return null;
      }
    },
    queryKey: ["fan-of-week"],
    staleTime: 5 * 60 * 1000
  });

  const slides = useMemo(
    () =>
      [
        creator
          ? {
              content: <CreatorOfWeekCard creator={creator} />,
              key: "creator",
              label: "Creator"
            }
          : null,
        fan
          ? {
              content: <FanOfWeekCard fan={fan} />,
              key: "fan",
              label: "Fan"
            }
          : null
      ].filter(Boolean) as Array<{
        content: ReactNode;
        key: string;
        label: string;
      }>,
    [creator, fan]
  );

  useEffect(() => {
    if (activeSlide >= slides.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, slides.length]);

  if (isCreatorLoading && isFanLoading) {
    return <CreatorWeekSkeleton />;
  }

  if (!slides.length) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div className="w-full shrink-0" key={slide.key}>
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((slide, index) => {
            const isActive = index === activeSlide;
            return (
              <button
                aria-label={`Show ${slide.label.toLowerCase()} spotlight`}
                className={`h-1.5 rounded-full transition-all ${
                  isActive
                    ? "w-5 bg-gray-900 dark:bg-white"
                    : "w-1.5 bg-gray-300 dark:bg-white/20"
                }`}
                key={slide.key}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const WhoToFollow = () => {
  const { currentAccount } = useAccountStore();
  const [showMore, setShowMore] = useState(false);

  const { data, error, loading } = useAccountRecommendationsQuery({
    variables: {
      request: {
        account: currentAccount?.address,
        pageSize: PageSize.Fifty,
        shuffle: true
      }
    }
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Hero variant="sidebar" />
        <CreatorWeekSlider />
        <Card className="space-y-2.5 p-3.5">
          <Title>Who to follow</Title>
          {Array.from(
            { length: RECOMMENDATION_LIMIT },
            (_, index) => `placeholder-${index}`
          ).map((id) => (
            <div className="flex items-center gap-x-3" key={id}>
              <div className="w-full">
                <SingleAccountShimmer showFollowUnfollowButton />
              </div>
              <XMarkIcon className="size-4 text-gray-500" />
            </div>
          ))}
          <div className="pt-0.5">
            <Skeleton className="h-3 w-5/12 rounded-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!data?.mlAccountRecommendations.items.length) {
    return <CreatorWeekSlider />;
  }

  const recommendedAccounts = data?.mlAccountRecommendations.items.filter(
    (account) =>
      !account.operations?.isBlockedByMe &&
      !account.operations?.isFollowedByMe &&
      !account.operations?.hasBlockedMe
  ) as AccountFragment[];

  if (!recommendedAccounts?.length) {
    return <CreatorWeekSlider />;
  }

  return (
    <>
      <div className="space-y-4">
        <Hero variant="sidebar" />
        <CreatorWeekSlider />
        <Card className="space-y-2.5 p-3.5">
          <Title>Who to follow</Title>
          <ErrorMessage error={error} title="Failed to load recommendations" />
          {recommendedAccounts
            ?.slice(0, RECOMMENDATION_LIMIT)
            .map((account) => (
              <div
                className="flex items-center gap-x-3 truncate"
                key={account?.address}
              >
                <div className="w-full">
                  <SingleAccount
                    account={account}
                    followButtonClassName="min-w-[4.5rem] px-2.5 py-0 text-[11px] leading-none"
                    hideFollowButton={
                      currentAccount?.address === account.address
                    }
                    hideUnfollowButton={
                      currentAccount?.address === account.address
                    }
                  />
                </div>
                <DismissRecommendedAccount account={account} />
              </div>
            ))}
          {recommendedAccounts.length > RECOMMENDATION_LIMIT && (
            <button
              className="pt-0.5 font-semibold text-[12px] text-gray-500 dark:text-gray-200"
              onClick={() => setShowMore(true)}
              type="button"
            >
              Show more
            </button>
          )}
        </Card>
      </div>
      <Modal
        onClose={() => setShowMore(false)}
        show={showMore}
        title="Suggested for you"
      >
        <Suggested accounts={recommendedAccounts} />
      </Modal>
    </>
  );
};

export default memo(WhoToFollow);
