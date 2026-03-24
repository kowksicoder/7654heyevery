import { NoSymbolIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import NewPost from "@/components/Composer/NewPost";
import Custom404 from "@/components/Shared/404";
import Custom500 from "@/components/Shared/500";
import Cover from "@/components/Shared/Cover";
import PageLayout from "@/components/Shared/PageLayout";
import { EmptyState } from "@/components/Shared/UI";
import { STATIC_IMAGES_URL } from "@/data/constants";
import { AccountFeedType } from "@/data/enums";
import getAccount from "@/helpers//getAccount";
import getAvatar from "@/helpers//getAvatar";
import isAccountDeleted from "@/helpers//isAccountDeleted";
import {
  EVERY1_PROFILE_QUERY_KEY,
  getPublicEvery1Profile
} from "@/helpers/every1";
import {
  getBlockedByMeMessage,
  getBlockedMeMessage
} from "@/helpers/getBlockedMessage";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useAccountQuery } from "@/indexer/generated";
import { useAccountLinkStore } from "@/store/non-persisted/navigation/useAccountLinkStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import AccountFeed from "./AccountFeed";
import DeletedDetails from "./DeletedDetails";
import Details from "./Details";
import FeedType from "./FeedType";
import AccountPageShimmer from "./Shimmer";

const ViewAccount = () => {
  const location = useLocation();
  const { address, username } = useParams<{
    address: string;
    username: string;
  }>();
  const [feedType, setFeedType] = useState<AccountFeedType>(
    AccountFeedType.Feed
  );

  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { cachedAccount, setCachedAccount } = useAccountLinkStore();
  const hasConfiguredSupabase = hasSupabaseConfig();
  const normalizedAddress = address?.trim().toLowerCase();
  const normalizedUsername = username?.trim().toLowerCase();
  const isCurrentProfileRoute =
    Boolean(
      normalizedAddress &&
        [
          currentAccount?.address,
          currentAccount?.owner,
          profile?.lensAccountAddress,
          profile?.walletAddress
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase() === normalizedAddress)
    ) ||
    Boolean(
      normalizedUsername &&
        [
          currentAccount?.username?.localName,
          currentAccount?.username?.value,
          profile?.username,
          profile?.zoraHandle
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase() === normalizedUsername)
    );

  const { data: publicEvery1Profile, isLoading: loadingEvery1Profile } =
    useQuery({
      enabled:
        hasConfiguredSupabase &&
        !isCurrentProfileRoute &&
        Boolean(normalizedAddress || normalizedUsername),
      queryFn: async () =>
        await getPublicEvery1Profile({
          address: normalizedAddress,
          username: normalizedUsername
        }),
      queryKey: [
        EVERY1_PROFILE_QUERY_KEY,
        "public",
        normalizedAddress || null,
        normalizedUsername || null
      ]
    });

  const { data, error, loading } = useAccountQuery({
    onCompleted: (data) => {
      if (data?.account) {
        setCachedAccount(null);
      }
    },
    skip:
      Boolean(isCurrentProfileRoute || publicEvery1Profile) ||
      (address ? !address : !username),
    variables: {
      request: {
        ...(address
          ? { address }
          : { username: { localName: username as string } })
      }
    }
  });

  const account =
    (isCurrentProfileRoute ? currentAccount : null) ??
    (publicEvery1Profile
      ? buildAccountFromEvery1Profile(publicEvery1Profile, address || null)
      : null) ??
    data?.account ??
    cachedAccount;

  if (
    (!username && !address) ||
    ((loading || loadingEvery1Profile) && !cachedAccount && !account)
  ) {
    return <AccountPageShimmer />;
  }

  if (!account) {
    return <Custom404 />;
  }

  if (error) {
    return <Custom500 />;
  }

  const isDeleted = isAccountDeleted(account);
  const isBlockedByMe = account?.operations?.isBlockedByMe;
  const hasBlockedMe = account?.operations?.hasBlockedMe;

  const accountInfo = getAccount(account);
  const profileImage =
    (typeof account.metadata?.coverPicture === "string"
      ? account.metadata.coverPicture
      : null) || getAvatar(account);
  const shareHandle = accountInfo.username.startsWith("#")
    ? accountInfo.username
    : `@${accountInfo.username}`;
  const profileDescription = isDeleted
    ? `${shareHandle} is no longer available on Every1.`
    : account.metadata?.bio?.trim() ||
      `View ${shareHandle}'s public profile on Every1.`;
  const shouldRedirectToCanonicalProfile =
    accountInfo.link.startsWith("/@") && location.pathname !== accountInfo.link;

  if (shouldRedirectToCanonicalProfile) {
    return (
      <Navigate
        replace
        to={`${accountInfo.link}${location.search}${location.hash}`}
      />
    );
  }

  const renderAccountDetails = () => {
    if (isDeleted) return <DeletedDetails account={account} />;

    return (
      <Details
        account={account}
        hasBlockedMe={account?.operations?.hasBlockedMe || false}
        isBlockedByMe={account?.operations?.isBlockedByMe || false}
      />
    );
  };

  const renderEmptyState = () => {
    const message = isDeleted
      ? "Account Deleted"
      : isBlockedByMe
        ? getBlockedByMeMessage(account)
        : hasBlockedMe
          ? getBlockedMeMessage(account)
          : null;

    return (
      <EmptyState
        icon={<NoSymbolIcon className="size-8" />}
        message={message}
      />
    );
  };

  return (
    <PageLayout
      description={profileDescription}
      image={profileImage}
      title={`${accountInfo.name} (${shareHandle}) - Every1`}
      type="profile"
      zeroTopMargin
    >
      <Cover
        className="h-36 sm:h-44 md:h-52 md:rounded-[1.5rem]"
        cover={
          account?.metadata?.coverPicture ||
          `${STATIC_IMAGES_URL}/patterns/2.svg`
        }
      />
      {renderAccountDetails()}
      {isDeleted || isBlockedByMe || hasBlockedMe ? (
        renderEmptyState()
      ) : (
        <>
          <FeedType feedType={feedType} setFeedType={setFeedType} />
          {currentAccount?.address === account?.address && <NewPost />}
          {(feedType === AccountFeedType.Feed ||
            feedType === AccountFeedType.Replies ||
            feedType === AccountFeedType.Media ||
            feedType === AccountFeedType.Collects) && (
            <AccountFeed
              address={account.address}
              type={feedType}
              username={accountInfo.username}
            />
          )}
        </>
      )}
    </PageLayout>
  );
};

export default ViewAccount;
