import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  QueueListIcon,
  Squares2X2Icon
} from "@heroicons/react/24/outline";
import MenuTransition from "@/components/Shared/MenuTransition";
import { Tabs } from "@/components/Shared/UI";
import { HomeFeedSort, type HomeFeedType, HomeFeedView } from "@/data/enums";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import { zoraHomeFeedConfig } from "./zoraHomeFeedConfig";

const FeedType = () => {
  const {
    feedType,
    setFeedType,
    setSortMode,
    sortMode,
    toggleViewMode,
    viewMode
  } = useHomeTabStore();

  const tabs = Object.entries(zoraHomeFeedConfig).map(([type, config]) => ({
    name: config.label,
    type
  }));

  const ToggleIcon =
    viewMode === HomeFeedView.GRID ? QueueListIcon : Squares2X2Icon;
  const toggleLabel =
    viewMode === HomeFeedView.GRID
      ? "Switch to list view"
      : "Switch to grid view";
  const sortOptions = [
    { label: "Latest", value: HomeFeedSort.LATEST },
    { label: "Oldest", value: HomeFeedSort.OLDEST }
  ];
  return (
    <div className="mx-3 mb-3 flex items-center gap-1.5 md:mx-0 md:mb-4 md:gap-2">
      <Tabs
        active={feedType}
        className="min-w-0 flex-1 gap-1 md:gap-2"
        desktopScrollable
        itemClassName="rounded-md px-2 py-0.75 text-[11px] md:rounded-lg md:px-2.5 md:py-1 md:text-[13px]"
        layoutId="home_tab"
        mobileScrollable
        setActive={(type) => {
          const nextType = type as HomeFeedType;
          setFeedType(nextType);
        }}
        tabs={tabs}
      />
      <Menu as="div" className="relative shrink-0">
        <MenuButton
          aria-label="Sort feed"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-gray-100 px-2 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-950 md:h-9 md:rounded-xl md:px-2.5 dark:bg-white/8 dark:text-gray-300 dark:hover:bg-white/12 dark:hover:text-gray-50"
        >
          <AdjustmentsHorizontalIcon className="size-3.5 md:size-4" />
        </MenuButton>
        <MenuTransition>
          <MenuItems className="absolute right-0 z-10 mt-2 min-w-32 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-xs outline-hidden dark:border-gray-800 dark:bg-black">
            {sortOptions.map((option) => (
              <MenuItem as="div" key={option.value}>
                <button
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-50"
                  onClick={() => setSortMode(option.value)}
                  type="button"
                >
                  <span>{option.label}</span>
                  {sortMode === option.value ? (
                    <span className="font-semibold text-emerald-600 text-xs dark:text-emerald-400">
                      Active
                    </span>
                  ) : null}
                </button>
              </MenuItem>
            ))}
          </MenuItems>
        </MenuTransition>
      </Menu>
      <button
        aria-label={toggleLabel}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-950 md:size-9 md:rounded-xl dark:bg-white/8 dark:text-gray-300 dark:hover:bg-white/12 dark:hover:text-gray-50"
        onClick={toggleViewMode}
        title={toggleLabel}
        type="button"
      >
        <ToggleIcon className="size-4 md:size-4.5" />
      </button>
    </div>
  );
};

export default FeedType;
