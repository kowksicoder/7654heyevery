import { CheckBadgeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router";
import JoinLeaveButton from "@/components/Shared/Group/JoinLeaveButton";
import { H3, Image, StackedAvatars } from "@/components/Shared/UI";
import { getPublicProfilePathByHandle } from "@/helpers/getAccount";
import type { Every1CommunityDetails } from "@/types/every1";

interface DetailsProps {
  community: Every1CommunityDetails;
}

const Details = ({ community }: DetailsProps) => {
  const stackedMembers = community.membersPreview
    .filter((member) => Boolean(member.avatarUrl))
    .slice(0, 5)
    .map((member) => member.avatarUrl as string);

  return (
    <div className="mb-4 space-y-4 px-5 md:px-0">
      <div className="flex items-start justify-between gap-4">
        <div className="relative -mt-20 ml-5 size-28 shrink-0 rounded-2xl bg-gray-100 ring-4 ring-gray-50 dark:bg-gray-900 dark:ring-black">
          {community.avatarUrl ? (
            <Image
              alt={community.name}
              className="size-full rounded-2xl object-cover"
              src={community.avatarUrl}
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-2xl text-gray-500 dark:text-gray-300">
              <UserGroupIcon className="size-10" />
            </div>
          )}
        </div>
        <JoinLeaveButton community={community} />
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <H3 className="truncate">{community.name}</H3>
            {community.verificationStatus === "verified" ? (
              <CheckBadgeIcon className="size-5 text-emerald-500" />
            ) : null}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:bg-gray-900 dark:text-gray-400">
              {community.visibility}
            </span>
          </div>
          <div className="text-gray-500 text-sm dark:text-gray-400">
            @{community.slug}
          </div>
        </div>

        {community.description ? (
          <p className="max-w-2xl text-gray-700 text-sm leading-6 dark:text-gray-300">
            {community.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-gray-500 text-sm dark:text-gray-400">
          <span>{community.memberCount} members</span>
          <span>{community.postCount} posts</span>
          <span>
            Led by{" "}
            {community.ownerUsername ? (
              <Link
                className="font-medium text-gray-700 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
                to={getPublicProfilePathByHandle(community.ownerUsername)}
              >
                {community.ownerDisplayName ||
                  community.ownerUsername ||
                  "community owner"}
              </Link>
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {community.ownerDisplayName || "community owner"}
              </span>
            )}
          </span>
        </div>

        {stackedMembers.length ? (
          <div className="flex items-center gap-3">
            <StackedAvatars avatars={stackedMembers} limit={5} />
            <span className="text-gray-500 text-sm dark:text-gray-400">
              Active members
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Details;
