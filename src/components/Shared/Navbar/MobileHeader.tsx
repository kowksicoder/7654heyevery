import {
  BellIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  TrophyIcon
} from "@heroicons/react/24/solid";
import { memo, useCallback } from "react";
import { Link, useLocation } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { Image } from "@/components/Shared/UI";
import { DEFAULT_COLLECT_TOKEN, NATIVE_TOKEN_SYMBOL } from "@/data/constants";
import getAvatar from "@/helpers/getAvatar";
import nFormatter from "@/helpers/nFormatter";
import { hasSupabaseConfig } from "@/helpers/supabase";
import useEvery1MobileNavBadgeCounts from "@/hooks/useEvery1MobileNavBadgeCounts";
import useEvery1UnreadCount from "@/hooks/useEvery1UnreadCount";
import useHasNewNotifications from "@/hooks/useHasNewNotifications";
import { useBalancesBulkQuery } from "@/indexer/generated";
import { useMobileDrawerModalStore } from "@/store/non-persisted/modal/useMobileDrawerModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const MobileHeader = () => {
  const { pathname } = useLocation();
  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { setShow: setShowMobileDrawer } = useMobileDrawerModalStore();
  const hasNewNotifications = useHasNewNotifications();
  const { leaderboardCount } = useEvery1MobileNavBadgeCounts();
  const unreadEvery1Count = useEvery1UnreadCount();
  const notificationCount =
    hasSupabaseConfig() && profile?.id
      ? unreadEvery1Count
      : hasNewNotifications
        ? 1
        : 0;
  const leaderboardBadgeCount = pathname.startsWith("/leaderboard")
    ? 0
    : leaderboardCount;
  const { data: balanceData } = useBalancesBulkQuery({
    pollInterval: 5000,
    skip: !currentAccount?.address,
    variables: {
      request: {
        address: currentAccount?.address,
        includeNative: true,
        tokens: [DEFAULT_COLLECT_TOKEN]
      }
    }
  });

  const handleDrawerOpen = useCallback(() => {
    setShowMobileDrawer(true);
  }, [setShowMobileDrawer]);

  const nativeBalance = balanceData?.balancesBulk.find(
    (balance) => balance.__typename === "NativeAmount"
  );
  const wrappedBalance = balanceData?.balancesBulk.find(
    (balance) =>
      balance.__typename === "Erc20Amount" &&
      balance.asset.contract.address.toLowerCase() ===
        DEFAULT_COLLECT_TOKEN.toLowerCase()
  );
  const totalWalletBalance =
    Number.parseFloat(
      nativeBalance?.__typename === "NativeAmount" ? nativeBalance.value : "0"
    ) +
    Number.parseFloat(
      wrappedBalance?.__typename === "Erc20Amount" ? wrappedBalance.value : "0"
    );
  const walletBadgeLabel = `${nFormatter(totalWalletBalance, 2) || "0"} ${NATIVE_TOKEN_SYMBOL}`;

  return (
    <header className="sticky top-0 z-[6] bg-gray-50 px-4 py-3 md:hidden dark:bg-black">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {currentAccount ? (
            <button
              aria-label="Open account menu"
              onClick={handleDrawerOpen}
              type="button"
            >
              <Image
                alt={currentAccount.address}
                className="size-8 rounded-full object-cover"
                height={32}
                src={getAvatar(currentAccount)}
                width={32}
              />
            </button>
          ) : (
            <button
              aria-label="Open menu"
              onClick={handleDrawerOpen}
              type="button"
            >
              <Image
                alt="Login"
                className="size-8 rounded-full object-cover"
                height={32}
                src={evLogo}
                width={32}
              />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            aria-label="Support"
            className="flex size-8 items-center justify-center text-gray-800 transition-colors hover:text-gray-950 dark:text-gray-200 dark:hover:text-white"
            to="/support"
          >
            <ChatBubbleOvalLeftEllipsisIcon className="size-4.5" />
          </Link>

          <Link
            aria-label="Leaderboard"
            className="relative flex size-8 items-center justify-center text-gray-800 transition-colors hover:text-gray-950 dark:text-gray-200 dark:hover:text-white"
            to="/leaderboard"
          >
            <TrophyIcon className="size-4.5" />
            {leaderboardBadgeCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full border border-white bg-pink-500 px-1 text-center font-semibold text-[10px] text-white leading-4 dark:border-gray-950">
                {leaderboardBadgeCount > 9 ? "9+" : leaderboardBadgeCount}
              </span>
            ) : null}
          </Link>

          <Link
            aria-label="Notifications"
            className="relative flex size-8 items-center justify-center text-gray-800 transition-colors hover:text-gray-950 dark:text-gray-200 dark:hover:text-white"
            to="/notifications"
          >
            <BellIcon className="size-4.5" />
            {notificationCount ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full border border-white bg-pink-500 px-1 text-center font-semibold text-[10px] text-white leading-4 dark:border-gray-950">
                {notificationCount}
              </span>
            ) : null}
          </Link>

          <div className="flex min-w-0 items-center">
            <Link
              aria-label="Open wallet"
              className="inline-flex h-8 max-w-[6.75rem] items-center truncate rounded-full bg-[#14b85a] px-2.5 font-semibold text-[11px] text-white leading-none transition-colors hover:bg-[#11a350] dark:bg-[#14b85a] dark:text-white dark:hover:bg-[#11a350]"
              to="/wallet"
            >
              {walletBadgeLabel}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(MobileHeader);
