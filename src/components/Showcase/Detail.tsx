import { DocumentTextIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { memo } from "react";
import { Navigate, useParams } from "react-router";
import BackButton from "@/components/Shared/BackButton";
import PageLayout from "@/components/Shared/PageLayout";
import { Card, CardHeader, Image, Spinner } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import useShowcasePosts from "@/hooks/useShowcasePosts";
import { getShowcaseIcon } from "./data";

const formatShowcaseDate = (value: string) => dayjs(value).format("D MMM YYYY");

const ShowcaseDetail = () => {
  const { slug } = useParams();
  const { data: showcasePosts = [], isLoading } = useShowcasePosts();
  const post = showcasePosts.find((entry) => entry.slug === slug);

  if (isLoading) {
    return (
      <PageLayout title="Showcase">
        <Card
          className="mx-5 flex min-h-64 items-center justify-center md:mx-0"
          forceRounded
        >
          <Spinner />
        </Card>
      </PageLayout>
    );
  }

  if (!post) {
    return <Navigate replace to="/showcase" />;
  }

  const Icon = getShowcaseIcon(post.iconKey);

  return (
    <PageLayout description={post.description} title={post.title}>
      <Card className="mx-5 overflow-hidden p-4 md:mx-0 md:p-5" forceRounded>
        <CardHeader icon={<BackButton path="/showcase" />} title="Showcase" />

        <div className="space-y-5 px-1 pt-3">
          <div
            className={cn(
              "relative overflow-hidden rounded-[1.7rem] p-5 text-white",
              post.coverImageUrl ? "bg-gray-950" : post.coverClassName
            )}
          >
            {post.coverImageUrl ? (
              <>
                <Image
                  alt={post.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={post.coverImageUrl}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
              </>
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_30%)]" />
            <div className="absolute top-4 right-4 size-20 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 size-24 rounded-full bg-black/20 blur-2xl" />

            <div className="relative space-y-10 md:space-y-14">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[10px] tracking-tight",
                    post.pillClassName
                  )}
                >
                  {post.category}
                </span>
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/20 ring-1 ring-white/15 backdrop-blur">
                  <Icon className="size-4" />
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="max-w-[24rem] font-semibold text-2xl leading-8 tracking-tight md:text-4xl md:leading-[1.05]">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80 uppercase tracking-[0.16em]">
                  <span>{formatShowcaseDate(post.publishedAt)}</span>
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  <span>{post.readTime}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-[0.18em] dark:text-gray-400">
              <DocumentTextIcon className="size-4" />
              <span>Story details</span>
            </div>

            <p className="max-w-3xl font-medium text-base text-gray-700 leading-7 dark:text-gray-300">
              {post.description}
            </p>

            <div className="max-w-3xl space-y-4 text-gray-600 text-sm leading-7 dark:text-gray-400">
              {post.content.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </PageLayout>
  );
};

export default memo(ShowcaseDetail);
