import { UserGroupIcon } from "@heroicons/react/24/outline";
import SingleGroup from "@/components/Shared/Group/SingleGroup";
import GroupListShimmer from "@/components/Shared/Shimmer/GroupListShimmer";
import { EmptyState, ErrorMessage } from "@/components/Shared/UI";
import { GroupsFeedType } from "@/data/enums";
import useEvery1Communities from "@/hooks/useEvery1Communities";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface ListProps {
  feedType: GroupsFeedType;
}

const EMPTY_STATE_COPY: Record<GroupsFeedType, string> = {
  [GroupsFeedType.Discover]: "No communities found yet.",
  [GroupsFeedType.Managed]: "You are not managing any communities yet.",
  [GroupsFeedType.Member]: "You have not joined any communities yet."
};

const mapFeedType = (
  feedType: GroupsFeedType
): "discover" | "managed" | "member" => {
  switch (feedType) {
    case GroupsFeedType.Managed:
      return "managed";
    case GroupsFeedType.Member:
      return "member";
    default:
      return "discover";
  }
};

const List = ({ feedType }: ListProps) => {
  const { profile } = useEvery1Store();
  const { data, error, isLoading } = useEvery1Communities({
    feedType: mapFeedType(feedType),
    limit: 60,
    profileId: profile?.id || null
  });

  if (isLoading) {
    return <GroupListShimmer />;
  }

  if (error) {
    return (
      <ErrorMessage
        className="m-5"
        error={error}
        title="Failed to load communities"
      />
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        hideCard
        icon={<UserGroupIcon className="size-8" />}
        message={EMPTY_STATE_COPY[feedType]}
      />
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {data.map((community) => (
        <div className="p-5" key={community.id}>
          <SingleGroup community={community} isBig showDescription />
        </div>
      ))}
    </div>
  );
};

export default List;
