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
import type { FollowingRequest } from "@/indexer/generated";
import { PageSize, useFollowingQuery } from "@/indexer/generated";
import { accountsList } from "@/variants";

interface FollowingProps {
  profileId?: null | string;
  username: string;
  address: string;
}

const Following = ({ username, address, profileId }: FollowingProps) => {
  const request: FollowingRequest = {
    account: address,
    pageSize: PageSize.Fifty
  };
  const {
    data: every1Following,
    error: every1Error,
    isLoading: loadingEvery1Following
  } = useEvery1FollowList({
    limit: 100,
    mode: "following",
    profileId
  });

  const { data, error, fetchMore, loading } = useFollowingQuery({
    skip: Boolean(profileId) || !address,
    variables: { request }
  });

  const followings = profileId
    ? every1Following?.map((following) =>
        buildAccountFromEvery1Profile({
          avatarUrl: following.avatarUrl,
          bannerUrl: following.bannerUrl,
          bio: following.bio,
          displayName: following.displayName,
          e1xpTotal: 0,
          id: following.id,
          lensAccountAddress: following.lensAccountAddress,
          referralCode: null,
          username: following.username,
          walletAddress: following.walletAddress,
          zoraHandle: following.zoraHandle
        })
      )
    : data?.following?.items.map((following) => following.following);
  const pageInfo = data?.following?.pageInfo;
  const hasMore = !profileId && pageInfo?.next;

  const handleEndReached = useCallback(async () => {
    if (hasMore) {
      await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
    }
  }, [fetchMore, hasMore, pageInfo?.next, request]);

  const loadMoreRef = useLoadMoreOnIntersect(handleEndReached);

  if ((profileId && loadingEvery1Following) || (!profileId && loading)) {
    return <AccountListShimmer />;
  }

  if (!followings?.length) {
    return (
      <EmptyState
        hideCard
        icon={<UsersIcon className="size-8" />}
        message={
          <div>
            <span className="mr-1 font-bold">@{username}</span>
            <span>doesn't follow anyone.</span>
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
        title="Failed to load following"
      />
    );
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <Virtualizer>
        {followings.map((following, index) => (
          <motion.div
            animate="visible"
            className={cn(
              "divider p-5",
              index === followings.length - 1 && "border-b-0"
            )}
            initial="hidden"
            key={following.address}
            variants={accountsList}
          >
            <SingleAccount
              account={following}
              showBio
              showUserPreview={false}
            />
          </motion.div>
        ))}
        {hasMore && <span ref={loadMoreRef} />}
      </Virtualizer>
    </div>
  );
};

export default Following;
