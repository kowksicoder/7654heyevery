import { BeakerIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
import * as HoverCard from "@radix-ui/react-hover-card";
import { useQuery } from "@tanstack/react-query";
import plur from "plur";
import { type ReactNode, useEffect, useState } from "react";
import Markup from "@/components/Shared/Markup";
import Slug from "@/components/Shared/Slug";
import { Card, Image } from "@/components/Shared/UI";
import getAccount from "@/helpers//getAccount";
import getAvatar from "@/helpers//getAvatar";
import {
  EVERY1_PROFILE_QUERY_KEY,
  getPublicEvery1Profile
} from "@/helpers/every1";
import getMentions from "@/helpers/getMentions";
import nFormatter from "@/helpers/nFormatter";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import { hasSupabaseConfig } from "@/helpers/supabase";
import truncateByWords from "@/helpers/truncateByWords";
import useEvery1AccountProfile from "@/hooks/useEvery1AccountProfile";
import useEvery1FollowRelationship from "@/hooks/useEvery1FollowRelationship";
import useEvery1FollowStats from "@/hooks/useEvery1FollowStats";
import {
  type AccountStats,
  useFullAccountLazyQuery
} from "@/indexer/generated";
import ENSBadge from "./ENSBadge";
import FollowUnfollowButton from "./FollowUnfollowButton";

interface AccountPreviewProps {
  children: ReactNode;
  username?: string;
  address?: string;
  showUserPreview?: boolean;
}

const AccountPreview = ({
  children,
  username,
  address,
  showUserPreview = true
}: AccountPreviewProps) => {
  const [previewRequested, setPreviewRequested] = useState(false);
  const hasConfiguredSupabase = hasSupabaseConfig();
  const [loadAccount, { data, loading }] = useFullAccountLazyQuery();
  const { data: every1Profile, isLoading: loadingEvery1Profile } = useQuery({
    enabled:
      hasConfiguredSupabase && previewRequested && Boolean(address || username),
    queryFn: async () =>
      await getPublicEvery1Profile({
        address,
        username
      }),
    queryKey: [EVERY1_PROFILE_QUERY_KEY, "account-preview", address, username]
  });
  const account = data?.account;
  const stats = data?.accountStats as AccountStats;
  const every1PreviewAccount = every1Profile
    ? buildAccountFromEvery1Profile(every1Profile, address || null)
    : null;
  const previewAccount = every1PreviewAccount ?? account;
  const { profileId } = useEvery1AccountProfile(previewAccount);
  const { relationship } = useEvery1FollowRelationship(profileId);
  const { stats: every1FollowStats } = useEvery1FollowStats(profileId);

  useEffect(() => {
    if (
      !previewRequested ||
      !hasConfiguredSupabase ||
      loadingEvery1Profile ||
      every1PreviewAccount ||
      account ||
      loading
    ) {
      return;
    }

    void loadAccount({
      variables: {
        accountRequest: {
          ...(address
            ? { address }
            : { username: { localName: username as string } })
        },
        accountStatsRequest: { account: address }
      }
    });
  }, [
    account,
    address,
    every1PreviewAccount,
    hasConfiguredSupabase,
    loadAccount,
    loading,
    loadingEvery1Profile,
    previewRequested,
    username
  ]);

  const onPreviewStart = async () => {
    setPreviewRequested(true);

    if (account || loading || hasConfiguredSupabase) {
      return;
    }

    await loadAccount({
      variables: {
        accountRequest: {
          ...(address
            ? { address }
            : { username: { localName: username as string } })
        },
        accountStatsRequest: { account: address }
      }
    });
  };

  if (!address && !username) {
    return null;
  }

  if (!showUserPreview) {
    return <span>{children}</span>;
  }

  const Preview = () => {
    if (loading || loadingEvery1Profile) {
      return (
        <div className="flex flex-col">
          <div className="flex p-3">
            <div>{username || `#${address}`}</div>
          </div>
        </div>
      );
    }

    if (!previewAccount) {
      return (
        <div className="flex h-12 items-center px-3">No account found</div>
      );
    }

    const UserAvatar = () => (
      <Image
        alt={previewAccount.address}
        className="size-12 rounded-full border border-gray-200 bg-gray-200 dark:border-gray-700"
        height={48}
        loading="lazy"
        src={getAvatar(previewAccount)}
        width={48}
      />
    );

    const UserName = () => (
      <div>
        <div className="flex max-w-sm items-center gap-1 truncate">
          <div>{getAccount(previewAccount).name}</div>
          {previewAccount.hasSubscribed && (
            <CheckBadgeIcon className="size-4 text-brand-500" />
          )}
          {previewAccount.isBeta && (
            <BeakerIcon className="size-4 text-green-500" />
          )}
          <ENSBadge account={previewAccount} className="size-4" />
        </div>
        <span>
          <Slug
            className="text-sm"
            slug={getAccount(previewAccount).username}
          />
          {(relationship.isFollowingMe ||
            previewAccount.operations?.isFollowingMe) && (
            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">
              Follows you
            </span>
          )}
        </span>
      </div>
    );

    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <UserAvatar />
          <FollowUnfollowButton account={previewAccount} small />
        </div>
        <UserName />
        {previewAccount.metadata?.bio && (
          <div className="linkify mt-2 break-words text-sm leading-6">
            <Markup mentions={getMentions(previewAccount.metadata.bio)}>
              {truncateByWords(previewAccount.metadata.bio, 20)}
            </Markup>
          </div>
        )}
        {profileId ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <div className="text-base">
                {nFormatter(every1FollowStats.following)}
              </div>
              <div className="text-gray-500 text-sm dark:text-gray-200">
                Following
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="text-base">
                {nFormatter(every1FollowStats.followers)}
              </div>
              <div className="text-gray-500 text-sm dark:text-gray-200">
                {plur("Follower", every1FollowStats.followers)}
              </div>
            </div>
          </div>
        ) : every1PreviewAccount ? null : (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <div className="text-base">
                {nFormatter(stats.graphFollowStats?.following)}
              </div>
              <div className="text-gray-500 text-sm dark:text-gray-200">
                Following
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="text-base">
                {nFormatter(stats.graphFollowStats?.followers)}
              </div>
              <div className="text-gray-500 text-sm dark:text-gray-200">
                {plur("Follower", stats.graphFollowStats?.followers)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <span onFocus={onPreviewStart} onMouseOver={onPreviewStart}>
      <HoverCard.Root>
        <HoverCard.Trigger asChild>
          <span>{children}</span>
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            asChild
            className="z-10 w-72"
            side="bottom"
            sideOffset={5}
          >
            <div>
              <Card forceRounded>
                <Preview />
              </Card>
            </div>
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </span>
  );
};

export default AccountPreview;
