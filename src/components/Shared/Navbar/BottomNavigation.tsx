import {
  MapIcon as CompassOutline,
  PlusCircleIcon as CreateOutline,
  StarIcon as CreatorsOutline,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon as SwapOutline
} from "@heroicons/react/24/outline";
import {
  MapIcon as CompassSolid,
  PlusCircleIcon as CreateSolid,
  StarIcon as CreatorsSolid,
  ArrowsRightLeftIcon as SwapSolid
} from "@heroicons/react/24/solid";
import type { MouseEvent, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Image } from "@/components/Shared/UI";
import getAvatar from "@/helpers//getAvatar";
import { useMobileDrawerModalStore } from "@/store/non-persisted/modal/useMobileDrawerModalStore";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import MobileDrawerMenu from "./MobileDrawerMenu";

interface NavigationItemProps {
  path: string;
  label: string;
  outline: ReactNode;
  solid: ReactNode;
  isActive: boolean;
  onClick?: (e: MouseEvent) => void;
}

const NavigationItem = ({
  path,
  label,
  outline,
  solid,
  isActive,
  onClick
}: NavigationItemProps) => (
  <Link
    aria-label={label}
    className="relative flex flex-1 justify-center py-3"
    onClick={onClick}
    to={path}
  >
    {isActive ? solid : outline}
  </Link>
);

const BottomNavigation = () => {
  const { pathname } = useLocation();
  const { currentAccount } = useAccountStore();
  const { show: showMobileDrawer, setShow: setShowMobileDrawer } =
    useMobileDrawerModalStore();

  const handleAccountClick = () => setShowMobileDrawer(true);

  const handleHomClick = (path: string, e: MouseEvent) => {
    if (path === "/" && pathname === "/") {
      e.preventDefault();
      window.scrollTo(0, 0);
    }
  };

  const navigationItems = [
    {
      label: "Explore",
      outline: <CompassOutline className="size-6" />,
      path: "/",
      solid: <CompassSolid className="size-6" />
    },
    {
      label: "Search",
      outline: <MagnifyingGlassIcon className="size-6" />,
      path: "/search",
      solid: <MagnifyingGlassIcon className="size-6" />
    },
    {
      label: "Create",
      outline: <CreateOutline className="size-6" />,
      path: "/create",
      solid: <CreateSolid className="size-6" />
    },
    {
      label: "Swap",
      outline: <SwapOutline className="size-6" />,
      path: "/swap",
      solid: <SwapSolid className="size-6" />
    },
    {
      label: "Creators",
      outline: <CreatorsOutline className="size-6" />,
      path: "/creators",
      solid: <CreatorsSolid className="size-6" />
    }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[5] border-gray-200 border-t bg-white pb-safe md:hidden dark:border-gray-800 dark:bg-black">
      {showMobileDrawer && <MobileDrawerMenu />}
      <div className="flex items-center justify-between gap-1 px-1">
        {navigationItems.map(({ path, label, outline, solid }) => (
          <NavigationItem
            isActive={pathname === path}
            key={path}
            label={label}
            onClick={(e) => handleHomClick(path, e)}
            outline={outline}
            path={path}
            solid={solid}
          />
        ))}
        {currentAccount && (
          <button
            aria-label="Your account"
            className="flex flex-1 justify-center"
            onClick={handleAccountClick}
            type="button"
          >
            <Image
              alt={currentAccount.address}
              className="size-6 rounded-full border border-gray-200 dark:border-gray-700"
              src={getAvatar(currentAccount)}
            />
          </button>
        )}
      </div>
    </nav>
  );
};

export default BottomNavigation;
