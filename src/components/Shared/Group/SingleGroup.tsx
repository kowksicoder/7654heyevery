import { CheckBadgeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { memo } from "react";
import { Link } from "react-router";
import { Image } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import type {
  Every1CommunityDetails,
  Every1CommunitySummary
} from "@/types/every1";
import JoinLeaveButton from "./JoinLeaveButton";

interface SingleGroupProps {
  hideJoinButton?: boolean;
  hideLeaveButton?: boolean;
  isBig?: boolean;
  linkToGroup?: boolean;
  showDescription?: boolean;
  community: Every1CommunityDetails | Every1CommunitySummary;
}

const getCommunityAvatar = (
  community: Every1CommunityDetails | Every1CommunitySummary
) => community.avatarUrl || community.ownerAvatarUrl || null;

const SingleGroup = ({
  hideJoinButton = false,
  hideLeaveButton = false,
  isBig = false,
  linkToGroup = true,
  showDescription = false,
  community
}: SingleGroupProps) => {
  const GroupAvatar = () => (
    <div
      className={cn(
        isBig ? "size-14 rounded-xl" : "size-11 rounded-lg",
        "flex shrink-0 items-center justify-center overflow-hidden bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-300"
      )}
    >
      {getCommunityAvatar(community) ? (
        <Image
          alt={community.name}
          className="size-full object-cover"
          src={getCommunityAvatar(community) as string}
        />
      ) : (
        <UserGroupIcon className={cn(isBig ? "size-7" : "size-5")} />
      )}
    </div>
  );

  const GroupInfo = () => (
    <div className="mr-6 flex min-w-0 items-center gap-3">
      <GroupAvatar />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate font-semibold text-gray-950 dark:text-white">
            {community.name}
          </div>
          {community.verificationStatus === "verified" ? (
            <CheckBadgeIcon className="size-4 shrink-0 text-emerald-500" />
          ) : null}
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:bg-gray-900 dark:text-gray-400">
            {community.memberCount} members
          </span>
        </div>
        <div className="mt-1 text-gray-500 text-sm dark:text-gray-400">
          @{community.slug}
        </div>
        {showDescription && community.description ? (
          <div className="mt-2 line-clamp-2 text-gray-600 text-sm dark:text-gray-400">
            {community.description}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3">
      {linkToGroup ? (
        <Link className="min-w-0 flex-1" to={`/g/${community.slug}`}>
          <GroupInfo />
        </Link>
      ) : (
        <div className="min-w-0 flex-1">
          <GroupInfo />
        </div>
      )}
      <JoinLeaveButton
        community={community}
        hideJoinButton={hideJoinButton}
        hideLeaveButton={hideLeaveButton}
        small
      />
    </div>
  );
};

export default memo(SingleGroup);
