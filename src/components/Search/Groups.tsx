import { UserGroupIcon } from "@heroicons/react/24/outline";
import SingleGroup from "@/components/Shared/Group/SingleGroup";
import SingleGroupShimmer from "@/components/Shared/Shimmer/SingleGroupShimmer";
import { Card, EmptyState, ErrorMessage } from "@/components/Shared/UI";
import useEvery1Communities from "@/hooks/useEvery1Communities";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface GroupsProps {
  query: string;
}

const Groups = ({ query }: GroupsProps) => {
  const { profile } = useEvery1Store();
  const normalizedQuery = query.trim();

  const { data, error, isLoading } = useEvery1Communities({
    enabled: Boolean(normalizedQuery),
    feedType: "discover",
    limit: 40,
    profileId: profile?.id || null,
    search: normalizedQuery
  });

  if (!normalizedQuery) {
    return null;
  }

  if (isLoading) {
    return <SingleGroupShimmer isBig />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load communities" />;
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<UserGroupIcon className="size-8" />}
        message={
          <span>
            No communities for <b>&ldquo;{query}&rdquo;</b>
          </span>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data.map((community) => (
        <Card
          className="rounded-[28px] border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-[#090909]"
          forceRounded
          key={community.id}
        >
          <SingleGroup community={community} isBig showDescription />
        </Card>
      ))}
    </div>
  );
};

export default Groups;
