import { HomeFeedSort, HomeFeedType, HomeFeedView } from "@/data/enums";
import { Localstorage } from "@/data/storage";
import { createPersistedTrackedStore } from "@/store/createTrackedStore";

interface State {
  feedType: HomeFeedType;
  sortMode: HomeFeedSort;
  viewMode: HomeFeedView;
  setFeedType: (feedType: HomeFeedType) => void;
  setSortMode: (sortMode: HomeFeedSort) => void;
  toggleViewMode: () => void;
}

const { useStore: useHomeTabStore } = createPersistedTrackedStore<State>(
  (set) => ({
    feedType: HomeFeedType.FOLLOWING,
    setFeedType: (feedType) => set(() => ({ feedType })),
    setSortMode: (sortMode) => set(() => ({ sortMode })),
    sortMode: HomeFeedSort.LATEST,
    toggleViewMode: () =>
      set((state) => ({
        viewMode:
          state.viewMode === HomeFeedView.GRID
            ? HomeFeedView.LIST
            : HomeFeedView.GRID
      })),
    viewMode: HomeFeedView.GRID
  }),
  { name: Localstorage.HomeTabStore }
);

export { useHomeTabStore };
