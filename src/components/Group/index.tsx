import { useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import Custom404 from "@/components/Shared/404";
import Custom500 from "@/components/Shared/500";
import Cover from "@/components/Shared/Cover";
import PageLayout from "@/components/Shared/PageLayout";
import { WarningMessage } from "@/components/Shared/UI";
import { STATIC_IMAGES_URL } from "@/data/constants";
import useEvery1Community from "@/hooks/useEvery1Community";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import CommunityVerification from "./CommunityVerification";
import Details from "./Details";
import GroupFeed from "./GroupFeed";
import GroupPageShimmer from "./Shimmer";

const ViewGroup = () => {
  const { address } = useParams<{ address: string }>();
  const [searchParams] = useSearchParams();
  const { profile } = useEvery1Store();
  const { data, error, isLoading } = useEvery1Community({
    profileId: profile?.id || null,
    slug: address
  });

  if (!address || isLoading) {
    return <GroupPageShimmer />;
  }

  if (error) {
    return <Custom500 />;
  }

  if (!data) {
    return <Custom404 />;
  }

  const showCreatedSetup = searchParams.get("created") === "1" && data.isOwner;

  const handleCopyCommunityLink = async () => {
    try {
      const cleanUrl = `${window.location.origin}/g/${data.slug}`;
      await navigator.clipboard.writeText(cleanUrl);
      toast.success("Community link copied");
    } catch {
      toast.error("Could not copy the community link");
    }
  };

  return (
    <PageLayout
      description={data.description || `${data.name} community feed`}
      title={data.name}
      zeroTopMargin
    >
      <Cover cover={data.bannerUrl || `${STATIC_IMAGES_URL}/patterns/2.svg`} />
      <Details community={data} />
      {showCreatedSetup ? (
        <div className="mx-5 mb-4 rounded-[1.35rem] border border-emerald-200 bg-emerald-50/80 p-4 md:mx-0 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-emerald-700 text-sm dark:text-emerald-300">
                Community created
              </p>
              <p className="mt-1 text-gray-800 text-sm leading-6 dark:text-gray-100">
                Your community and coin are live together now. Next, invite
                admins, start verification, and publish the first update.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="rounded-full bg-gray-950 px-3 py-1.5 font-medium text-sm text-white dark:bg-white dark:text-black"
                href="#community-verification"
              >
                Start verification
              </a>
              <a
                className="rounded-full border border-gray-200 px-3 py-1.5 font-medium text-gray-900 text-sm dark:border-white/10 dark:text-white"
                href="#community-feed"
              >
                Open chat
              </a>
              <button
                className="rounded-full border border-gray-200 px-3 py-1.5 font-medium text-gray-900 text-sm dark:border-white/10 dark:text-white"
                onClick={handleCopyCommunityLink}
                type="button"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <CommunityVerification community={data} />
      {data.membershipStatus === "requested" ? (
        <WarningMessage
          message="Your membership request is pending review from the community owner."
          title="Request pending"
        />
      ) : null}
      <GroupFeed community={data} />
    </PageLayout>
  );
};

export default ViewGroup;
