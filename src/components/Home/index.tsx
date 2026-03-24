import { useEffect, useState } from "react";
import PageLayout from "@/components/Shared/PageLayout";
import { HomeFeedView } from "@/data/enums";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import FeedType from "./FeedType";
import Hero from "./Hero";
import ZoraFeed from "./ZoraFeed";

const Home = () => {
  const { viewMode } = useHomeTabStore();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const isReelMode = viewMode === HomeFeedView.LIST;
  const shouldRenderFullscreenReel = isMobileViewport && isReelMode;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return (
    <PageLayout
      desktopSidebarClassName="lg:w-[16.5rem] xl:w-[17rem]"
      mobileFullscreen={shouldRenderFullscreenReel}
      title="Explore"
      zeroTopMargin
    >
      {shouldRenderFullscreenReel ? null : (
        <>
          {isMobileViewport ? <Hero /> : null}
          <FeedType />
        </>
      )}
      <ZoraFeed />
    </PageLayout>
  );
};

export default Home;
