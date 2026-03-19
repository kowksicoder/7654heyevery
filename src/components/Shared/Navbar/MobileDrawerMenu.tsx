import {
  ArrowRightStartOnRectangleIcon,
  ArrowsRightLeftIcon,
  BellIcon,
  BoltIcon,
  Cog6ToothIcon,
  FlagIcon,
  InformationCircleIcon,
  PlusCircleIcon,
  SparklesIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import { Link, useLocation } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { useSignupStore } from "@/components/Shared/Auth/Signup";
import { Button, Image } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import getAccount from "@/helpers/getAccount";
import reloadAllTabs from "@/helpers/reloadAllTabs";
import useHasNewNotifications from "@/hooks/useHasNewNotifications";
import { useAuthModalStore } from "@/store/non-persisted/modal/useAuthModalStore";
import { useMobileDrawerModalStore } from "@/store/non-persisted/modal/useMobileDrawerModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { signOut } from "@/store/persisted/useAuthStore";

const isActivePath = (pathname: string, path: string) => {
  if (path === "/") {
    return pathname === "/";
  }

  return pathname === path || pathname.startsWith(`${path}/`);
};

const MobileDrawerMenu = () => {
  const { pathname } = useLocation();
  const { currentAccount } = useAccountStore();
  const { setShowAuthModal } = useAuthModalStore();
  const { setScreen } = useSignupStore();
  const { setShow: setShowMobileDrawer } = useMobileDrawerModalStore();
  const hasNewNotifications = useHasNewNotifications();
  const notificationCount = hasNewNotifications ? 1 : 0;

  const handleCloseDrawer = () => {
    setShowMobileDrawer(false);
  };

  const itemClass =
    "flex w-full items-center justify-between gap-2.5 rounded-[0.95rem] px-3 py-2.5 text-left text-[15px] font-medium leading-5 transition-colors";

  const loggedInPrimaryItems = [
    {
      icon: <UserCircleIcon className="size-5" />,
      label: "Profile",
      path: getAccount(currentAccount).link
    },
    {
      icon: <UserGroupIcon className="size-5" />,
      label: "Community",
      path: "/groups"
    },
    {
      badge: notificationCount ? notificationCount.toString() : undefined,
      icon: <BellIcon className="size-4.5" />,
      label: "Notifications",
      path: "/notifications"
    },
    {
      icon: <PlusCircleIcon className="size-4.5" />,
      label: "Create",
      path: "/create"
    },
    {
      badge: "NEW",
      icon: <SparklesIcon className="size-4.5" />,
      label: "Creators",
      path: "/creators"
    },
    {
      icon: <TrophyIcon className="size-4.5" />,
      label: "Leaderboard",
      path: "/leaderboard"
    },
    {
      icon: <ArrowsRightLeftIcon className="size-4.5" />,
      label: "Swap",
      path: "/swap"
    },
    {
      icon: <FlagIcon className="size-4.5" />,
      label: "Missions",
      path: "/missions"
    },
    {
      icon: <BoltIcon className="size-4.5" />,
      label: "Streaks",
      path: "/streaks"
    },
    {
      icon: <Cog6ToothIcon className="size-4.5" />,
      label: "Settings",
      path: "/settings"
    }
  ];

  const loggedOutPrimaryItems = [
    {
      icon: <UserGroupIcon className="size-4.5" />,
      label: "Community",
      path: "/groups"
    },
    {
      icon: <PlusCircleIcon className="size-4.5" />,
      label: "Create",
      path: "/create"
    },
    {
      badge: "NEW",
      icon: <SparklesIcon className="size-4.5" />,
      label: "Creators",
      path: "/creators"
    },
    {
      icon: <TrophyIcon className="size-4.5" />,
      label: "Leaderboard",
      path: "/leaderboard"
    },
    {
      icon: <ArrowsRightLeftIcon className="size-4.5" />,
      label: "Swap",
      path: "/swap"
    },
    {
      icon: <FlagIcon className="size-4.5" />,
      label: "Missions",
      path: "/missions"
    },
    {
      icon: <BoltIcon className="size-4.5" />,
      label: "Streaks",
      path: "/streaks"
    }
  ];

  const primaryItems = currentAccount
    ? loggedInPrimaryItems
    : loggedOutPrimaryItems;

  return (
    <div
      className="fixed inset-0 z-10 bg-black/8 px-2.5 pt-12 pb-3 backdrop-blur-[1px] md:hidden"
      onClick={handleCloseDrawer}
    >
      <div
        className="max-h-[calc(100dvh-4rem)] w-[17.5rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[1.35rem] bg-white p-2 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.32)] dark:bg-gray-950 dark:shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        {currentAccount ? null : (
          <div className="space-y-2 px-2 pb-2">
            <div className="flex items-center gap-2.5">
              <Image
                alt="Every1"
                className="size-8 rounded-xl object-cover"
                height={32}
                src={evLogo}
                width={32}
              />
              <div className="space-y-0.5">
                <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Every1
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Open social for everyone.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  handleCloseDrawer();
                  setShowAuthModal(true);
                }}
                size="sm"
              >
                Login
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  handleCloseDrawer();
                  setScreen("choose");
                  setShowAuthModal(true, "signup");
                }}
                outline
                size="sm"
              >
                Signup
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {primaryItems.map(({ badge, icon, label, path }) => {
            const isActive = isActivePath(pathname, path);

            return (
              <Link
                className={cn(
                  itemClass,
                  isActive
                    ? "bg-gray-100 text-gray-950 dark:bg-gray-900 dark:text-gray-50"
                    : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
                )}
                key={path}
                onClick={handleCloseDrawer}
                to={path}
              >
                <span className="flex items-center gap-3">
                  <span className="text-gray-700 dark:text-gray-300">
                    {icon}
                  </span>
                  <span>{label}</span>
                </span>
                {badge ? (
                  <span
                    className={cn(
                      "min-w-6 rounded-lg px-2 py-0.5 text-center font-semibold text-[10px] leading-4",
                      label === "Notifications"
                        ? "bg-pink-500 text-white"
                        : "bg-fuchsia-200 text-fuchsia-900"
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="my-1 border-gray-200 border-t dark:border-gray-800" />

          {currentAccount ? (
            <Link
              className={cn(
                itemClass,
                isActivePath(pathname, "/support")
                  ? "bg-gray-100 text-gray-950 dark:bg-gray-900 dark:text-gray-50"
                  : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
              )}
              onClick={handleCloseDrawer}
              to="/support"
            >
              <span className="flex items-center gap-3">
                <InformationCircleIcon className="size-4.5 text-gray-700 dark:text-gray-300" />
                <span>Help center</span>
              </span>
            </Link>
          ) : null}

          {currentAccount ? (
            <button
              className={cn(
                itemClass,
                "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
              )}
              onClick={async () => {
                await signOut();
                reloadAllTabs();
                handleCloseDrawer();
              }}
              type="button"
            >
              <span className="flex items-center gap-3">
                <ArrowRightStartOnRectangleIcon className="size-4.5 text-gray-700 dark:text-gray-300" />
                <span>Sign out</span>
              </span>
            </button>
          ) : (
            <>
              <Link
                className={cn(
                  itemClass,
                  isActivePath(pathname, "/support")
                    ? "bg-gray-100 text-gray-950 dark:bg-gray-900 dark:text-gray-50"
                    : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
                )}
                onClick={handleCloseDrawer}
                to="/support"
              >
                <span className="flex items-center gap-3">
                  <InformationCircleIcon className="size-4.5 text-gray-700 dark:text-gray-300" />
                  <span>Help center</span>
                </span>
              </Link>
              <button
                className={cn(
                  itemClass,
                  "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900"
                )}
                onClick={() => {
                  handleCloseDrawer();
                  setShowAuthModal(true);
                }}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <ArrowRightStartOnRectangleIcon className="size-4.5 text-gray-700 dark:text-gray-300" />
                  <span>Sign in</span>
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileDrawerMenu;
