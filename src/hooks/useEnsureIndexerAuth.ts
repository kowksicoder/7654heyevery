import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { useWalletClient } from "wagmi";
import { hasPrivyConfig } from "@/helpers/privy";
import {
  useAuthenticateMutation,
  useChallengeMutation
} from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import {
  clearAuthTokens,
  signIn,
  useAuthStore
} from "@/store/persisted/useAuthStore";

let authAttemptInFlight: null | Promise<void> = null;
let authAttemptKeyInFlight: null | string = null;

const useEnsureIndexerAuth = () => {
  const hasPrivy = hasPrivyConfig();
  const { authenticated, ready } = usePrivy();
  const { currentAccount } = useAccountStore();
  const { accessToken } = useAuthStore();
  const { data: walletClient } = useWalletClient();
  const [challengeMutation] = useChallengeMutation();
  const [authenticateMutation] = useAuthenticateMutation();
  const [authenticating, setAuthenticating] = useState(false);
  const failedAttemptKeyRef = useRef<null | string>(null);

  const accountAddress = currentAccount?.address;
  const ownerAddress = currentAccount?.owner || walletClient?.account?.address;
  const isDirectWalletAccount = Boolean(
    accountAddress &&
      ownerAddress &&
      accountAddress.toLowerCase() === ownerAddress.toLowerCase()
  );
  const authAttemptKey =
    accountAddress && ownerAddress ? `${accountAddress}:${ownerAddress}` : null;
  const shouldAuthenticate =
    hasPrivy &&
    ready &&
    authenticated &&
    Boolean(authAttemptKey) &&
    Boolean(walletClient?.account) &&
    !accessToken;

  useEffect(() => {
    if (accessToken && authAttemptKey) {
      failedAttemptKeyRef.current = null;
    }
  }, [accessToken, authAttemptKey]);

  useEffect(() => {
    if (
      !shouldAuthenticate ||
      !authAttemptKey ||
      !accountAddress ||
      !ownerAddress ||
      !walletClient?.account
    ) {
      return;
    }

    if (failedAttemptKeyRef.current === authAttemptKey) {
      return;
    }

    let cancelled = false;

    const authenticateIndexerSession = async () => {
      try {
        setAuthenticating(true);

        const { data: challengeData } = await challengeMutation({
          variables: {
            request: isDirectWalletAccount
              ? {
                  onboardingUser: {
                    wallet: ownerAddress
                  }
                }
              : {
                  accountOwner: {
                    account: accountAddress,
                    owner: ownerAddress
                  }
                }
          }
        });

        const challenge = challengeData?.challenge;

        if (!challenge) {
          throw new Error("Failed to create authentication challenge.");
        }

        const signature = await walletClient.signMessage({
          account: walletClient.account,
          message: challenge.text
        });

        const { data: authenticateData } = await authenticateMutation({
          variables: {
            request: {
              id: challenge.id,
              signature
            }
          }
        });

        const authResult = authenticateData?.authenticate;

        if (!authResult || authResult.__typename !== "AuthenticationTokens") {
          throw new Error(
            authResult?.__typename === "ForbiddenError"
              ? authResult.reason || "Authentication was rejected."
              : "Failed to authenticate wallet session."
          );
        }

        signIn({
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken
        });
        failedAttemptKeyRef.current = null;
      } catch (error) {
        failedAttemptKeyRef.current = authAttemptKey;
        clearAuthTokens();
        console.error("Failed to authenticate indexer session", error);
      }
    };

    setAuthenticating(true);

    if (authAttemptInFlight && authAttemptKeyInFlight === authAttemptKey) {
      void authAttemptInFlight.finally(() => {
        if (!cancelled) {
          setAuthenticating(false);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    authAttemptKeyInFlight = authAttemptKey;
    authAttemptInFlight = authenticateIndexerSession();

    void authAttemptInFlight.finally(() => {
      authAttemptInFlight = null;
      authAttemptKeyInFlight = null;

      if (!cancelled) {
        setAuthenticating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    accountAddress,
    authAttemptKey,
    authenticateMutation,
    challengeMutation,
    isDirectWalletAccount,
    ownerAddress,
    shouldAuthenticate,
    walletClient
  ]);

  return {
    authenticating,
    canUseAuthenticatedIndexer: Boolean(accessToken),
    needsAuthenticatedIndexer: Boolean(currentAccount?.address) && !accessToken
  };
};

export default useEnsureIndexerAuth;
