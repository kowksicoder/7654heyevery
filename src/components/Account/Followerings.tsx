import plur from "plur";
import { type FC, useEffect, useState } from "react";
import { useLocation } from "react-router";
import Followers from "@/components/Shared/Modal/Followers";
import Following from "@/components/Shared/Modal/Following";
import { Modal } from "@/components/Shared/UI";
import getAccount from "@/helpers//getAccount";
import humanize from "@/helpers/humanize";
import { isEvery1OnlyAccount } from "@/helpers/privy";
import useEvery1AccountProfile from "@/hooks/useEvery1AccountProfile";
import useEvery1FollowStats from "@/hooks/useEvery1FollowStats";
import {
  type AccountFragment,
  useAccountStatsQuery
} from "@/indexer/generated";

interface FolloweringsProps {
  account: AccountFragment;
}

const Followerings = ({ account }: FolloweringsProps) => {
  const location = useLocation();
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const { profileId } = useEvery1AccountProfile(account);
  const supportsLegacyFeedStats = !isEvery1OnlyAccount(account);
  const { stats: every1FollowStats, isLoading: loadingEvery1FollowStats } =
    useEvery1FollowStats(profileId);

  useEffect(() => {
    setShowFollowersModal(false);
    setShowFollowingModal(false);
  }, [location.key]);

  const { data, loading } = useAccountStatsQuery({
    skip: !supportsLegacyFeedStats,
    variables: { request: { account: account.address } }
  });

  if (loadingEvery1FollowStats || (supportsLegacyFeedStats && loading)) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-19 animate-pulse rounded-[1.15rem] border border-gray-200/80 bg-gray-100/80 dark:border-gray-800 dark:bg-gray-900"
            key={index}
          />
        ))}
      </div>
    );
  }

  if (!profileId && !supportsLegacyFeedStats && !data) {
    return null;
  }

  const feedStats = data?.accountStats.feedStats;
  const stats = profileId
    ? {
        followers: every1FollowStats.followers,
        following: every1FollowStats.following,
        posts: feedStats?.posts ?? 0,
        replies: feedStats?.comments ?? 0
      }
    : {
        followers: data?.accountStats.graphFollowStats.followers ?? 0,
        following: data?.accountStats.graphFollowStats.following ?? 0,
        posts: feedStats?.posts ?? 0,
        replies: feedStats?.comments ?? 0
      };

  type ModalContentProps = {
    profileId?: null | string;
    username: string;
    address: string;
  };

  const renderModal = (
    show: boolean,
    setShow: (value: boolean) => void,
    title: string,
    Content: FC<ModalContentProps>
  ) => (
    <Modal onClose={() => setShow(false)} show={show} title={title}>
      <Content
        address={String(account.address)}
        profileId={profileId}
        username={getAccount(account).username}
      />
    </Modal>
  );

  const statClass =
    "rounded-[1.15rem] border border-gray-200/80 bg-gray-50/80 px-2.5 py-3 text-center transition-colors dark:border-gray-800 dark:bg-gray-900/80";

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      <div className={statClass}>
        <div className="font-semibold text-base text-gray-950 sm:text-lg dark:text-gray-50">
          {humanize(stats.posts)}
        </div>
        <div className="mt-1 text-[10px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
          Posts
        </div>
      </div>
      <div className={statClass}>
        <div className="font-semibold text-base text-gray-950 sm:text-lg dark:text-gray-50">
          {humanize(stats.replies)}
        </div>
        <div className="mt-1 text-[10px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
          Replies
        </div>
      </div>
      <button
        className={statClass}
        onClick={() => {
          umami.track("open_followers");
          setShowFollowersModal(true);
        }}
        type="button"
      >
        <div className="font-semibold text-base text-gray-950 sm:text-lg dark:text-gray-50">
          {humanize(stats.followers)}
        </div>
        <div className="mt-1 text-[10px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
          {plur("Follower", stats.followers)}
        </div>
      </button>
      <button
        className={statClass}
        onClick={() => {
          umami.track("open_following");
          setShowFollowingModal(true);
        }}
        type="button"
      >
        <div className="font-semibold text-base text-gray-950 sm:text-lg dark:text-gray-50">
          {humanize(stats.following)}
        </div>
        <div className="mt-1 text-[10px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
          Following
        </div>
      </button>
      {renderModal(
        showFollowingModal,
        setShowFollowingModal,
        "Following",
        Following
      )}
      {renderModal(
        showFollowersModal,
        setShowFollowersModal,
        "Followers",
        Followers
      )}
    </div>
  );
};

export default Followerings;
