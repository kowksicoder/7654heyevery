import { useApolloClient } from "@apollo/client";
import {
  BellIcon as BellOutline,
  BookmarkIcon as BookmarkOutline,
  MapIcon as CompassOutline,
  PlusCircleIcon as CreateOutline,
  StarIcon as CreatorsOutline,
  TrophyIcon as LeaderboardOutline,
  FlagIcon as MissionsOutline,
  BoltIcon as StreaksOutline,
  ArrowsRightLeftIcon as SwapOutline,
  UserGroupIcon as UserGroupOutline
} from "@heroicons/react/24/outline";
import {
  BellIcon as BellSolid,
  BookmarkIcon as BookmarkSolid,
  MapIcon as CompassSolid,
  PlusCircleIcon as CreateSolid,
  StarIcon as CreatorsSolid,
  TrophyIcon as LeaderboardSolid,
  FlagIcon as MissionsSolid,
  BoltIcon as StreaksSolid,
  ArrowsRightLeftIcon as SwapSolid,
  UserGroupIcon as UserGroupSolid
} from "@heroicons/react/24/solid";
import { useQueryClient } from "@tanstack/react-query";
import {
  type MouseEvent,
  memo,
  type ReactNode,
  useCallback,
  useState
} from "react";
import { Link, useLocation } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { ZORA_HOME_FEED_QUERY_KEY } from "@/components/Home/zoraHomeFeedConfig";
import { Image, Spinner, Tooltip } from "@/components/Shared/UI";
import useHasNewNotifications from "@/hooks/useHasNewNotifications";
import {
  GroupsDocument,
  NotificationIndicatorDocument,
  NotificationsDocument,
  PostBookmarksDocument
} from "@/indexer/generated";
import { useAuthModalStore } from "@/store/non-persisted/modal/useAuthModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import SignedAccount from "./SignedAccount";

const navigationItems = {
  "/": {
    outline: <CompassOutline className="size-6" />,
    solid: <CompassSolid className="size-6" />,
    title: "Explore"
  },
  "/bookmarks": {
    outline: <BookmarkOutline className="size-6" />,
    refreshDocs: [PostBookmarksDocument],
    solid: <BookmarkSolid className="size-6" />,
    title: "Bookmarks"
  },
  "/create": {
    outline: <CreateOutline className="size-6" />,
    solid: <CreateSolid className="size-6" />,
    title: "Create"
  },
  "/creators": {
    outline: <CreatorsOutline className="size-6" />,
    solid: <CreatorsSolid className="size-6" />,
    title: "Creators"
  },
  "/groups": {
    outline: <UserGroupOutline className="size-6" />,
    refreshDocs: [GroupsDocument],
    solid: <UserGroupSolid className="size-6" />,
    title: "Groups"
  },
  "/leaderboard": {
    outline: <LeaderboardOutline className="size-6" />,
    solid: <LeaderboardSolid className="size-6" />,
    title: "Leaderboard"
  },
  "/missions": {
    outline: <MissionsOutline className="size-6" />,
    solid: <MissionsSolid className="size-6" />,
    title: "Missions"
  },
  "/notifications": {
    outline: <BellOutline className="size-6" />,
    refreshDocs: [NotificationsDocument, NotificationIndicatorDocument],
    solid: <BellSolid className="size-6" />,
    title: "Notifications"
  },
  "/streaks": {
    outline: <StreaksOutline className="size-6" />,
    solid: <StreaksSolid className="size-6" />,
    title: "Streaks"
  },
  "/swap": {
    outline: <SwapOutline className="size-6" />,
    solid: <SwapSolid className="size-6" />,
    title: "Swap"
  }
};

interface NavItemProps {
  url: string;
  icon: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

const NavItem = memo(({ icon, onClick, url }: NavItemProps) => (
  <Tooltip content={navigationItems[url as keyof typeof navigationItems].title}>
    <Link onClick={onClick} to={url}>
      {icon}
    </Link>
  </Tooltip>
));

const NavItems = memo(({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { pathname } = useLocation();
  const hasNewNotifications = useHasNewNotifications();
  const client = useApolloClient();
  const queryClient = useQueryClient();
  const [refreshingRoute, setRefreshingRoute] = useState<string | null>(null);
  const routes = [
    "/",
    "/create",
    "/creators",
    "/leaderboard",
    "/swap",
    "/missions",
    "/streaks",
    ...(isLoggedIn ? ["/notifications", "/groups", "/bookmarks"] : [])
  ];

  return (
    <>
      {routes.map((route) => {
        let icon =
          pathname === route
            ? navigationItems[route as keyof typeof navigationItems].solid
            : navigationItems[route as keyof typeof navigationItems].outline;

        if (refreshingRoute === route) {
          icon = <Spinner className="my-0.5" size="sm" />;
        }

        const iconWithIndicator =
          route === "/notifications" ? (
            <span className="relative">
              {icon}
              {hasNewNotifications && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500" />
              )}
            </span>
          ) : (
            icon
          );

        const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
          const item = navigationItems[route as keyof typeof navigationItems];
          const isSameRoute = pathname === route;

          if (!isSameRoute) {
            return;
          }

          if (route === "/") {
            e.preventDefault();
            window.scrollTo(0, 0);
            setRefreshingRoute(route);
            try {
              await queryClient.invalidateQueries({
                queryKey: [ZORA_HOME_FEED_QUERY_KEY]
              });
            } finally {
              setRefreshingRoute(null);
            }
            return;
          }

          if (!("refreshDocs" in item) || !item.refreshDocs) {
            return;
          }

          e.preventDefault();
          window.scrollTo(0, 0);
          setRefreshingRoute(route);
          try {
            await client.refetchQueries({ include: item.refreshDocs });
          } finally {
            setRefreshingRoute(null);
          }
        };

        return (
          <NavItem
            icon={iconWithIndicator}
            key={route}
            onClick={handleClick}
            url={route}
          />
        );
      })}
    </>
  );
});

const Navbar = () => {
  const { pathname } = useLocation();
  const { currentAccount } = useAccountStore();
  const { setShowAuthModal } = useAuthModalStore();

  const handleLogoClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (pathname === "/") {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    },
    [pathname]
  );

  const handleAuthClick = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  return (
    <aside className="sticky top-5 mt-5 hidden w-10 shrink-0 flex-col items-center gap-y-5 md:flex">
      <Link onClick={handleLogoClick} to="/">
        <Image
          alt="Logo"
          className="size-8 rounded-lg object-cover"
          height={32}
          src={evLogo}
          width={32}
        />
      </Link>
      <NavItems isLoggedIn={!!currentAccount} />
      {currentAccount ? (
        <SignedAccount />
      ) : (
        <button onClick={handleAuthClick} type="button">
          <Tooltip content="Login">
            <Image
              alt="Profile"
              className="size-6 rounded-full object-cover"
              height={24}
              src={evLogo}
              width={24}
            />
          </Tooltip>
        </button>
      )}
    </aside>
  );
};

export default memo(Navbar);
