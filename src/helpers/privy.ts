import type { User } from "@privy-io/react-auth";
import type { AccountFragment } from "@/indexer/generated";
import type { Every1Profile } from "@/types/every1";

type Every1ProfileLike = Pick<
  Every1Profile,
  | "avatarUrl"
  | "bannerUrl"
  | "bio"
  | "displayName"
  | "e1xpTotal"
  | "id"
  | "lensAccountAddress"
  | "referralCode"
  | "username"
  | "walletAddress"
  | "zoraHandle"
> &
  Partial<
    Pick<
      Every1Profile,
      "verificationCategory" | "verificationStatus" | "verifiedAt"
    >
  >;

const sanitizeUsername = (value?: null | string) => {
  const normalized = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  return normalized || null;
};

export const hasPrivyConfig = () =>
  Boolean(import.meta.env.VITE_PRIVY_APP_ID as string | undefined);

export const getPrivyWalletAddress = (user?: null | User) => {
  if (!user) {
    return null;
  }

  if (user.wallet?.address) {
    return user.wallet.address;
  }

  const linkedWallet = user.linkedAccounts.find(
    (account) => account.type === "wallet" && account.chainType === "ethereum"
  ) as { address?: string } | undefined;

  return linkedWallet?.address || null;
};

export const getPrivyDisplayName = (user?: null | User) => {
  if (!user) {
    return null;
  }

  return (
    user.google?.name ||
    user.twitter?.name ||
    user.linkedin?.name ||
    user.github?.name ||
    user.line?.name ||
    user.tiktok?.name ||
    user.telegram?.firstName ||
    user.farcaster?.displayName ||
    user.email?.address?.split("@")[0] ||
    null
  );
};

export const getPrivyUsername = (user?: null | User) => {
  if (!user) {
    return null;
  }

  return sanitizeUsername(
    user.twitter?.username ||
      user.github?.username ||
      user.discord?.username ||
      user.instagram?.username ||
      user.tiktok?.username ||
      user.linkedin?.vanityName ||
      user.farcaster?.username ||
      user.telegram?.username ||
      user.email?.address?.split("@")[0] ||
      null
  );
};

export const getPrivyAvatarUrl = (user?: null | User) => {
  if (!user) {
    return null;
  }

  return (
    user.twitter?.profilePictureUrl ||
    user.line?.profilePictureUrl ||
    user.farcaster?.pfp ||
    user.telegram?.photoUrl ||
    null
  );
};

export const getPrivyBio = (user?: null | User) => {
  if (!user) {
    return null;
  }

  return user.farcaster?.bio || null;
};

export const getPrivyTwitterAccount = (user?: null | User) => {
  if (!user?.twitter) {
    return null;
  }

  return {
    displayName: user.twitter.name || null,
    profilePictureUrl: user.twitter.profilePictureUrl || null,
    subject: user.twitter.subject || null,
    username: sanitizeUsername(user.twitter.username)
  };
};

export const getPrivyInstagramAccount = (user?: null | User) => {
  if (!user?.instagram) {
    return null;
  }

  return {
    displayName: null,
    profilePictureUrl: null,
    subject: user.instagram.subject || null,
    username: sanitizeUsername(user.instagram.username)
  };
};

export const buildAccountFromPrivyUser = (
  user: User
): AccountFragment | undefined => {
  const address = getPrivyWalletAddress(user);

  if (!address) {
    return undefined;
  }

  const username = getPrivyUsername(user);
  const avatar = getPrivyAvatarUrl(user);
  const displayName = getPrivyDisplayName(user);
  const bio = getPrivyBio(user);

  return {
    __typename: "Account",
    address,
    hasSubscribed: false,
    isBeta: false,
    isStaff: false,
    metadata: {
      __typename: "AccountMetadata",
      attributes: [],
      bio,
      coverPicture: null,
      id: user.id,
      name: displayName,
      picture: avatar
    },
    operations: {
      __typename: "LoggedInAccountOperations",
      hasBlockedMe: false,
      id: user.id,
      isBlockedByMe: false,
      isFollowedByMe: false,
      isFollowingMe: false,
      isMutedByMe: false
    },
    owner: address,
    preferNameInFeed: true,
    rules: {
      __typename: "AccountFollowRules",
      anyOf: [],
      required: []
    },
    username: username
      ? {
          __typename: "Username",
          linkedTo: address,
          localName: username,
          namespace: "every1",
          ownedBy: address,
          value: username
        }
      : null
  } as AccountFragment;
};

export const mergeEvery1ProfileIntoAccount = (
  account: AccountFragment,
  profile?: Every1Profile | null
): AccountFragment => {
  if (!profile) {
    return account;
  }

  const mergedUsername =
    profile.username ||
    account.username?.localName ||
    account.username?.value ||
    null;
  const linkedAddress =
    profile.walletAddress || account.owner || account.address;

  return {
    ...account,
    address: profile.lensAccountAddress || account.address,
    hasSubscribed:
      profile.verificationStatus === "verified" || account.hasSubscribed,
    metadata: {
      ...account.metadata,
      bio: profile.bio || account.metadata?.bio || null,
      coverPicture: profile.bannerUrl || account.metadata?.coverPicture || null,
      id: profile.id || account.metadata?.id || account.address,
      name: profile.displayName || account.metadata?.name || null,
      picture: profile.avatarUrl || account.metadata?.picture || null
    },
    owner: linkedAddress,
    username: mergedUsername
      ? {
          __typename: "Username",
          linkedTo: linkedAddress,
          localName: mergedUsername,
          namespace: "every1",
          ownedBy: linkedAddress,
          value: mergedUsername
        }
      : account.username
  } as AccountFragment;
};

export const buildAccountFromEvery1Profile = (
  profile: Every1ProfileLike,
  fallbackAddress?: null | string
): AccountFragment => {
  const address =
    profile.lensAccountAddress ||
    profile.walletAddress ||
    fallbackAddress ||
    profile.id;
  const owner =
    profile.walletAddress ||
    profile.lensAccountAddress ||
    fallbackAddress ||
    profile.id;
  const username = profile.username || profile.zoraHandle || null;

  return {
    __typename: "Account",
    address,
    hasSubscribed: profile.verificationStatus === "verified",
    heyEns: null,
    isBeta: false,
    isStaff: false,
    metadata: {
      __typename: "AccountMetadata",
      attributes: [],
      bio: profile.bio,
      coverPicture: profile.bannerUrl,
      id: profile.id,
      name: profile.displayName,
      picture: profile.avatarUrl
    },
    operations: {
      __typename: "LoggedInAccountOperations",
      hasBlockedMe: false,
      id: profile.id,
      isBlockedByMe: false,
      isFollowedByMe: false,
      isFollowingMe: false,
      isMutedByMe: false
    },
    owner,
    preferNameInFeed: true,
    rules: {
      __typename: "AccountFollowRules",
      anyOf: [],
      required: []
    },
    username: username
      ? {
          __typename: "Username",
          linkedTo: owner,
          localName: username,
          namespace: "every1",
          ownedBy: owner,
          value: username
        }
      : null
  } as AccountFragment;
};

export const isEvery1OnlyAccount = (account?: AccountFragment | null) =>
  Boolean(account && account.username?.namespace === "every1");
