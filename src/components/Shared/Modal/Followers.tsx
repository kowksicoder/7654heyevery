import { UsersIcon } from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { useCallback } from "react";
import { Virtualizer } from "virtua";
import SingleAccount from "@/components/Shared/Account/SingleAccount";
import AccountListShimmer from "@/components/Shared/Shimmer/AccountListShimmer";
import { EmptyState, ErrorMessage } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import useEvery1FollowList from "@/hooks/useEvery1FollowList";
import useLoadMoreOnIntersect from "@/hooks/useLoadMoreOnIntersect";
import type { FollowersRequest } from "@/indexer/generated";
import { PageSize, useFollowersQuery } from "@/indexer/generated";
import { accountsList } from "@/variants";

interface FollowersProps {
  profileId?: null | string;
  username: string;
  address: string;
}

const Followers = ({ username, address, profileId }: FollowersProps) => {
  const request: FollowersRequest = {
    account: address,
    pageSize: PageSize.Fifty
  };
  const {
    data: every1Followers,
    error: every1Error,
    isLoading: loadingEvery1Followers
  } = useEvery1FollowList({
    limit: 100,
    mode: "followers",
    profileId
  });

  const { data, error, fetchMore, loading } = useFollowersQuery({
    skip: Boolean(profileId) || !address,
    variables: { request }
  });

  const followers = profileId
    ? every1Followers?.map((follower) =>
        buildAccountFromEvery1Profile({
          avatarUrl: follower.avatarUrl,
          bannerUrl: follower.bannerUrl,
          bio: follower.bio,
          displayName: follower.displayName,
          e1xpTotal: 0,
          id: follower.id,
          lensAccountAddress: follower.lensAccountAddress,
          referralCode: null,
          username: follower.username,
          walletAddress: follower.walletAddress,
          zoraHandle: follower.zoraHandle
        })
      )
    : data?.followers?.items.map((follower) => follower.follower);
  const pageInfo = data?.followers?.pageInfo;
  const hasMore = !profileId && pageInfo?.next;

  const handleEndReached = useCallback(async () => {
    if (hasMore) {
      await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
    }
  }, [fetchMore, hasMore, pageInfo?.next, request]);

  const loadMoreRef = useLoadMoreOnIntersect(handleEndReached);

  if ((profileId && loadingEvery1Followers) || (!profileId && loading)) {
    return <AccountListShimmer />;
  }

  if (!followers?.length) {
    return (
      <EmptyState
        hideCard
        icon={<UsersIcon className="size-8" />}
        message={
          <div>
            <span className="mr-1 font-bold">@{username}</span>
            <span>doesn't have any followers yet.</span>
          </div>
        }
      />
    );
  }

  if (profileId ? every1Error : error) {
    return (
      <ErrorMessage
        className="m-5"
        error={(profileId ? every1Error : error) as Error}
        title="Failed to load followers"
      />
    );
  }

  return (
    <div className="!h-[80vh] overflow-y-auto">
      <Virtualizer>
        {followers.map((follower, index) => (
          <motion.div
            animate="visible"
            className={cn(
              "divider p-5",
              index === followers.length - 1 && "border-b-0"
            )}
            initial="hidden"
            key={follower.address}
            variants={accountsList}
          >
            <SingleAccount account={follower} showBio showUserPreview={false} />
          </motion.div>
        ))}
        {hasMore && <span ref={loadMoreRef} />}
      </Virtualizer>
    </div>
  );
};

export default Followers;
