import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  EVERY1_PROFILE_QUERY_KEY,
  getPublicEvery1Profile
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import type { AccountFragment } from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type { Every1Profile } from "@/types/every1";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeValue = (value?: null | string) =>
  value?.trim().toLowerCase() || null;

const isUuid = (value?: null | string) =>
  Boolean(value && UUID_REGEX.test(value));

const matchesAny = (
  candidates: Array<null | string>,
  comparisons: Array<null | string>
) =>
  candidates.some((candidate) =>
    comparisons.some(
      (comparison) =>
        normalizeValue(candidate) &&
        normalizeValue(comparison) &&
        normalizeValue(candidate) === normalizeValue(comparison)
    )
  );

const useEvery1AccountProfile = (account?: AccountFragment | null) => {
  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const hasConfiguredSupabase = hasSupabaseConfig();

  const accountAddresses = useMemo(
    () => [account?.address || null, account?.owner || null],
    [account?.address, account?.owner]
  );
  const accountUsernames = useMemo(
    () => [
      account?.username?.localName || null,
      account?.username?.value || null
    ],
    [account?.username?.localName, account?.username?.value]
  );

  const isCurrentAccount = useMemo(
    () =>
      matchesAny(accountAddresses, [
        currentAccount?.address || null,
        currentAccount?.owner || null,
        profile?.walletAddress || null,
        profile?.lensAccountAddress || null
      ]) ||
      matchesAny(accountUsernames, [
        currentAccount?.username?.localName || null,
        currentAccount?.username?.value || null,
        profile?.username || null,
        profile?.zoraHandle || null
      ]),
    [
      accountAddresses,
      accountUsernames,
      currentAccount?.address,
      currentAccount?.owner,
      currentAccount?.username?.localName,
      currentAccount?.username?.value,
      profile?.lensAccountAddress,
      profile?.username,
      profile?.walletAddress,
      profile?.zoraHandle
    ]
  );

  const embeddedProfileId =
    !isCurrentAccount && isUuid(account?.metadata?.id)
      ? account?.metadata?.id
      : null;

  const query = useQuery({
    enabled:
      hasConfiguredSupabase &&
      !isCurrentAccount &&
      !embeddedProfileId &&
      Boolean(
        account?.address || account?.owner || account?.username?.localName
      ),
    queryFn: async () =>
      await getPublicEvery1Profile({
        address: account?.address || account?.owner || null,
        username:
          account?.username?.localName || account?.username?.value || null
      }),
    queryKey: [
      EVERY1_PROFILE_QUERY_KEY,
      "account",
      account?.address || null,
      account?.owner || null,
      account?.username?.localName || null,
      account?.username?.value || null
    ]
  });

  const resolvedProfile: Every1Profile | null =
    (isCurrentAccount ? profile : null) || query.data || null;

  return {
    ...query,
    profile: resolvedProfile,
    profileId: resolvedProfile?.id || embeddedProfileId || null
  };
};

export default useEvery1AccountProfile;
