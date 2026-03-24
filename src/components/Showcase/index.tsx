import { DocumentTextIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { memo } from "react";
import { Link } from "react-router";
import PageLayout from "@/components/Shared/PageLayout";
import { Card, ErrorMessage, Image } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import useShowcasePosts from "@/hooks/useShowcasePosts";
import { getShowcaseIcon } from "./data";

const formatShowcaseDate = (value: string) => dayjs(value).format("D MMM YYYY");

const Showcase = () => {
  const { data: showcasePosts = [], error } = useShowcasePosts();

  return (
    <PageLayout
      description="Every1 product notes, feature drops, design updates, and community stories."
      title="Showcase"
    >
      <Card
        className="relative mx-5 overflow-hidden px-5 py-6 md:mx-0 md:px-6"
        forceRounded
      >
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500" />
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950">
              <DocumentTextIcon className="size-6" />
            </div>
            <div>
              <p className="font-semibold text-gray-500 text-sm uppercase tracking-[0.22em]">
                Every1 Journal
              </p>
              <h1 className="font-semibold text-2xl text-gray-950 tracking-tight md:text-3xl dark:text-gray-50">
                Showcase
              </h1>
            </div>
          </div>

          <p className="max-w-2xl text-gray-600 text-sm dark:text-gray-400">
            A running home for product updates, creator highlights, design
            notes, and stories from across the platform.
          </p>
        </div>
      </Card>

      {error ? (
        <ErrorMessage error={error} title="Failed to load showcase" />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {showcasePosts.map((post) => {
          const Icon = getShowcaseIcon(post.iconKey);

          return (
            <Card
              className="mx-5 overflow-hidden p-3 md:mx-0"
              forceRounded
              key={post.id}
            >
              <div className="space-y-3">
                <Link
                  aria-label={`Open ${post.title}`}
                  className={cn(
                    "relative block h-40 overflow-hidden rounded-[1.4rem] p-3 text-white transition-transform hover:scale-[1.01]",
                    post.coverImageUrl ? "bg-gray-950" : post.coverClassName
                  )}
                  to={`/showcase/${post.slug}`}
                >
                  {post.coverImageUrl ? (
                    <>
                      <Image
                        alt={post.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        src={post.coverImageUrl}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                    </>
                  ) : null}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_30%)]" />
                  <div className="absolute top-3 right-3 size-16 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-5 -left-3 size-20 rounded-full bg-black/20 blur-2xl" />
                  <div className="relative flex h-full flex-col justify-between">
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

                    <div className="space-y-1.5">
                      <p className="max-w-[13rem] font-semibold text-[18px] leading-5 tracking-tight">
                        {post.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/80 uppercase tracking-[0.16em]">
                        <span>{formatShowcaseDate(post.publishedAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </PageLayout>
  );
};

export default memo(Showcase);
