import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { usePrivy } from "@privy-io/react-auth";
import { useIsClient } from "@uidotdev/usehooks";
import { memo, useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { Toaster, type ToasterProps } from "sonner";
import FullPageLoader from "@/components/Shared/FullPageLoader";
import GlobalAlerts from "@/components/Shared/GlobalAlerts";
import GlobalModals from "@/components/Shared/GlobalModals";
import Navbar from "@/components/Shared/Navbar";
import BottomNavigation from "@/components/Shared/Navbar/BottomNavigation";
import MobileHeader from "@/components/Shared/Navbar/MobileHeader";
import { Spinner } from "@/components/Shared/UI";
import { HomeFeedView } from "@/data/enums";
import cn from "@/helpers/cn";
import {
  buildAccountFromPrivyUser,
  hasPrivyConfig,
  mergeEvery1ProfileIntoAccount
} from "@/helpers/privy";
import { useTheme } from "@/hooks/useTheme";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import Every1RuntimeBridge from "./Every1RuntimeBridge";
import ReloadTabsWatcher from "./ReloadTabsWatcher";

const Layout = () => {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const { currentAccount, setCurrentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { viewMode } = useHomeTabStore();
  const isMounted = useIsClient();
  const { authenticated, ready, user } = usePrivy();
  const isStaffRoute = pathname.startsWith("/staff");
  const isHomeReelMode = pathname === "/" && viewMode === HomeFeedView.LIST;
  const hideMobileHeader =
    isStaffRoute || pathname.startsWith("/coins/") || isHomeReelMode;
  const hideBottomNavigation = isStaffRoute || isHomeReelMode;
  const privyAccount = useMemo(() => {
    const baseAccount = user ? buildAccountFromPrivyUser(user) : undefined;

    if (!baseAccount) {
      return undefined;
    }

    const profileMatchesWallet =
      profile?.walletAddress &&
      profile.walletAddress.toLowerCase() === baseAccount.owner.toLowerCase();

    return profileMatchesWallet
      ? mergeEvery1ProfileIntoAccount(baseAccount, profile)
      : baseAccount;
  }, [profile, user]);
  const hasPrivy = hasPrivyConfig();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!hasPrivy || !ready) {
      return;
    }

    if (!authenticated || !privyAccount) {
      if (currentAccount) {
        setCurrentAccount(undefined);
      }
      return;
    }

    if (
      currentAccount?.address !== privyAccount.address ||
      currentAccount?.metadata?.name !== privyAccount.metadata?.name ||
      currentAccount?.metadata?.picture !== privyAccount.metadata?.picture ||
      currentAccount?.metadata?.bio !== privyAccount.metadata?.bio ||
      currentAccount?.username?.value !== privyAccount.username?.value
    ) {
      setCurrentAccount(privyAccount);
    }
  }, [
    authenticated,
    currentAccount,
    hasPrivy,
    privyAccount,
    ready,
    setCurrentAccount
  ]);

  const accountLoading = !isMounted || (hasPrivy && !ready);

  if (accountLoading) {
    return <FullPageLoader />;
  }

  return (
    <>
      <Toaster
        icons={{
          error: <XCircleIcon className="size-5" />,
          loading: <Spinner size="xs" />,
          success: <CheckCircleIcon className="size-5" />
        }}
        position="bottom-right"
        theme={theme as ToasterProps["theme"]}
        toastOptions={{
          className: "every1-toast font-platform",
          style: { boxShadow: "none" }
        }}
      />
      <GlobalModals />
      <GlobalAlerts />
      <ReloadTabsWatcher />
      <Every1RuntimeBridge />
      {hideMobileHeader ? null : <MobileHeader />}
      <div
        className={cn("mx-auto flex w-full items-start px-0 md:px-5", {
          "max-w-[92rem]": isStaffRoute,
          "max-w-6xl gap-x-8": !isStaffRoute
        })}
      >
        {isStaffRoute ? null : <Navbar />}
        <Outlet />
        {hideBottomNavigation ? null : <BottomNavigation />}
      </div>
    </>
  );
};

export default memo(Layout);
