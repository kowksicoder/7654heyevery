import { usePrivy } from "@privy-io/react-auth";
import {
  type SmartWalletClientType,
  useSmartWallets
} from "@privy-io/react-auth/smart-wallets";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { base } from "viem/chains";
import { useWalletClient } from "wagmi";
import { EVERY1_PROFILE_QUERY_KEY } from "@/helpers/every1";
import {
  type ExecutionWalletClient,
  linkExecutionWallet,
  toExecutionWalletAddress,
  toViemWalletClient
} from "@/helpers/executionWallet";
import { hasBaseSmartWalletConfig } from "@/helpers/privy";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const asAddress = (value?: null | string) =>
  value && isAddress(value) ? value : null;

interface UseEvery1ExecutionWalletOptions {
  autoPrepare?: boolean;
}

const useEvery1ExecutionWallet = ({
  autoPrepare = false
}: UseEvery1ExecutionWalletOptions = {}) => {
  const queryClient = useQueryClient();
  const { authenticated, ready } = usePrivy();
  const { profile, setProfile } = useEvery1Store();
  const { data: identityWalletClient } = useWalletClient({ chainId: base.id });
  const { getClientForChain } = useSmartWallets();
  const [smartWalletClient, setSmartWalletClient] =
    useState<null | SmartWalletClientType>(null);
  const [smartWalletError, setSmartWalletError] = useState<null | string>(null);
  const [smartWalletLoading, setSmartWalletLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const linkedExecutionWalletRef = useRef<null | string>(null);
  const failedExecutionWalletLinkRef = useRef<null | string>(null);
  const linkingExecutionWalletRef = useRef<null | string>(null);
  const smartWalletLoadPromiseRef =
    useRef<null | Promise<null | SmartWalletClientType>>(null);
  const executionWalletLinkPromiseRef = useRef<null | Promise<null | string>>(
    null
  );

  const identityWalletAddress = asAddress(
    identityWalletClient?.account?.address || profile?.walletAddress
  );
  const smartWalletAddress = asAddress(smartWalletClient?.account?.address);
  const registeredExecutionWalletAddress = asAddress(
    toExecutionWalletAddress(profile)
  );

  const loadSmartWalletClient = useCallback(async () => {
    if (!hasBaseSmartWalletConfig()) {
      return null;
    }

    if (smartWalletClient) {
      return smartWalletClient;
    }

    if (!ready || !authenticated) {
      throw new Error("Sign in to prepare your Every1 wallet.");
    }

    if (smartWalletLoadPromiseRef.current) {
      return await smartWalletLoadPromiseRef.current;
    }

    const nextLoadPromise = (async () => {
      try {
        setSmartWalletLoading(true);
        const nextClient = await getClientForChain({ id: base.id });
        setSmartWalletClient(nextClient || null);
        setSmartWalletError(null);

        return nextClient || null;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to initialize your Every1 smart wallet.";

        setSmartWalletClient(null);
        setSmartWalletError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setSmartWalletLoading(false);
        smartWalletLoadPromiseRef.current = null;
      }
    })();

    smartWalletLoadPromiseRef.current = nextLoadPromise;

    return await nextLoadPromise;
  }, [authenticated, getClientForChain, ready, smartWalletClient]);

  const syncExecutionWalletAddress = useCallback(
    async (client: SmartWalletClientType) => {
      const nextSmartWalletAddress = asAddress(client.account?.address);

      if (!nextSmartWalletAddress) {
        throw new Error("Your Every1 smart wallet address is not ready yet.");
      }

      const targetLinkKey = `${profile?.id}:${nextSmartWalletAddress.toLowerCase()}`;

      if (
        registeredExecutionWalletAddress &&
        registeredExecutionWalletAddress.toLowerCase() ===
          nextSmartWalletAddress.toLowerCase()
      ) {
        linkedExecutionWalletRef.current = targetLinkKey;
        failedExecutionWalletLinkRef.current = null;
        linkingExecutionWalletRef.current = null;
        setSmartWalletError(null);
        return nextSmartWalletAddress;
      }

      if (
        !profile?.id ||
        !identityWalletAddress ||
        !identityWalletClient?.account
      ) {
        throw new Error("Your Every1 wallet is not ready yet.");
      }

      if (
        failedExecutionWalletLinkRef.current === targetLinkKey &&
        !executionWalletLinkPromiseRef.current
      ) {
        failedExecutionWalletLinkRef.current = null;
      }

      if (
        (linkedExecutionWalletRef.current === targetLinkKey ||
          linkingExecutionWalletRef.current === targetLinkKey) &&
        executionWalletLinkPromiseRef.current
      ) {
        await executionWalletLinkPromiseRef.current;
        return nextSmartWalletAddress;
      }

      const nextLinkPromise = (async () => {
        try {
          setIsLinking(true);
          linkingExecutionWalletRef.current = targetLinkKey;

          const result = await linkExecutionWallet({
            executionWalletAddress: nextSmartWalletAddress as Address,
            executionWalletClient: client,
            identityWalletAddress: identityWalletAddress as Address,
            identityWalletClient,
            profileId: profile.id
          });

          const nextProfile = profile
            ? {
                ...profile,
                executionWalletAddress: result.profile.executionWalletAddress
              }
            : profile;

          if (nextProfile) {
            setProfile(nextProfile);
            queryClient.setQueryData(
              [EVERY1_PROFILE_QUERY_KEY, profile.id],
              nextProfile
            );
          }

          linkedExecutionWalletRef.current = targetLinkKey;
          failedExecutionWalletLinkRef.current = null;
          setSmartWalletError(null);

          return (
            result.profile.executionWalletAddress || nextSmartWalletAddress
          );
        } catch (error) {
          failedExecutionWalletLinkRef.current = targetLinkKey;

          setSmartWalletError(
            error instanceof Error
              ? error.message
              : "Unable to link your Every1 smart wallet."
          );
          throw error instanceof Error
            ? error
            : new Error("Unable to link your Every1 smart wallet.");
        } finally {
          if (linkingExecutionWalletRef.current === targetLinkKey) {
            linkingExecutionWalletRef.current = null;
          }

          executionWalletLinkPromiseRef.current = null;
          setIsLinking(false);
        }
      })();

      executionWalletLinkPromiseRef.current = nextLinkPromise;

      await nextLinkPromise;

      return nextSmartWalletAddress;
    },
    [
      identityWalletAddress,
      identityWalletClient,
      profile,
      queryClient,
      registeredExecutionWalletAddress,
      setProfile
    ]
  );

  const prepareExecutionWallet = useCallback(async () => {
    if (!hasBaseSmartWalletConfig()) {
      return {
        executionWalletAddress: registeredExecutionWalletAddress,
        executionWalletClient: toViemWalletClient(
          smartWalletClient as ExecutionWalletClient | null
        )
      };
    }

    const client = await loadSmartWalletClient();

    if (!client) {
      throw new Error("Unable to initialize your Every1 smart wallet.");
    }

    const nextExecutionWalletAddress = await syncExecutionWalletAddress(client);
    const nextExecutionWalletClient = toViemWalletClient(
      client as ExecutionWalletClient
    );

    return {
      executionWalletAddress: asAddress(nextExecutionWalletAddress),
      executionWalletClient: nextExecutionWalletClient
    };
  }, [
    loadSmartWalletClient,
    registeredExecutionWalletAddress,
    smartWalletClient,
    syncExecutionWalletAddress
  ]);

  useEffect(() => {
    if (!hasBaseSmartWalletConfig() || !ready || !authenticated) {
      setSmartWalletClient(null);
      setSmartWalletError(null);
      setSmartWalletLoading(false);
      smartWalletLoadPromiseRef.current = null;
      executionWalletLinkPromiseRef.current = null;
      return;
    }
  }, [authenticated, ready]);

  useEffect(() => {
    if (
      !autoPrepare ||
      !hasBaseSmartWalletConfig() ||
      !ready ||
      !authenticated
    ) {
      return;
    }

    void prepareExecutionWallet().catch(() => undefined);
  }, [authenticated, autoPrepare, prepareExecutionWallet, ready]);

  const executionWalletAddress =
    smartWalletAddress || registeredExecutionWalletAddress;
  const executionWalletClient = toViemWalletClient(
    smartWalletClient as ExecutionWalletClient | null
  );

  return {
    executionWalletAddress,
    executionWalletClient,
    identityWalletAddress,
    identityWalletClient,
    isLinkingExecutionWallet: isLinking,
    isSmartWalletReady: Boolean(smartWalletClient && executionWalletAddress),
    prepareExecutionWallet,
    smartWalletAddress,
    smartWalletClient,
    smartWalletEnabled: hasBaseSmartWalletConfig(),
    smartWalletError,
    smartWalletLoading
  };
};

export default useEvery1ExecutionWallet;
