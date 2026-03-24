import {
  BellIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  FireIcon,
  GiftIcon,
  HeartIcon,
  SparklesIcon,
  UserGroupIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useRef } from "react";
import Loader from "@/components/Shared/Loader";
import { Card, EmptyState, ErrorMessage, Image } from "@/components/Shared/UI";
import { NotificationFeedType } from "@/data/enums";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import {
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  markNotificationsRead
} from "@/helpers/every1";
import useEvery1Notifications from "@/hooks/useEvery1Notifications";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type { Every1Notification } from "@/types/every1";

interface ListProps {
  feedType: string;
}

const FEED_KIND_MAP: Record<
  NotificationFeedType,
  Every1Notification["kind"][]
> = {
  [NotificationFeedType.Activity]: [
    "comment",
    "community",
    "follow",
    "like",
    "mission",
    "payment",
    "share",
    "streak",
    "verification"
  ],
  [NotificationFeedType.All]: [
    "comment",
    "community",
    "follow",
    "like",
    "mission",
    "nudge",
    "payment",
    "referral",
    "reward",
    "share",
    "streak",
    "system",
    "toast",
    "verification",
    "welcome"
  ],
  [NotificationFeedType.Referrals]: ["referral"],
  [NotificationFeedType.Rewards]: ["reward"],
  [NotificationFeedType.System]: [
    "nudge",
    "system",
    "toast",
    "verification",
    "welcome"
  ]
};

const kindIconMap: Record<Every1Notification["kind"], ReactNode> = {
  comment: <ChatBubbleOvalLeftEllipsisIcon className="size-5" />,
  community: <UserGroupIcon className="size-5" />,
  follow: <UserPlusIcon className="size-5" />,
  like: <HeartIcon className="size-5" />,
  mission: <SparklesIcon className="size-5" />,
  nudge: <FireIcon className="size-5" />,
  payment: <GiftIcon className="size-5" />,
  referral: <UserPlusIcon className="size-5" />,
  reward: <GiftIcon className="size-5" />,
  share: <SparklesIcon className="size-5" />,
  streak: <SparklesIcon className="size-5" />,
  system: <BellIcon className="size-5" />,
  toast: <BellIcon className="size-5" />,
  verification: <CheckCircleIcon className="size-5" />,
  welcome: <SparklesIcon className="size-5" />
};

const List = ({ feedType }: ListProps) => {
  const queryClient = useQueryClient();
  const { profile } = useEvery1Store();
  const isMarkingNotifications = useRef(false);
  const inFlightNotificationIds = useRef("");
  const lastMarkedNotificationIds = useRef("");
  const { data, error, isLoading } = useEvery1Notifications({
    limit: 80,
    refetchInterval: 15000,
    scope: feedType
  });

  const notifications = useMemo(() => {
    const allowedKinds = FEED_KIND_MAP[feedType as NotificationFeedType];
    return (data || []).filter((notification) =>
      allowedKinds.includes(notification.kind)
    );
  }, [data, feedType]);

  useEffect(() => {
    if (
      !profile?.id ||
      !notifications.length ||
      isMarkingNotifications.current
    ) {
      return;
    }

    const unreadIds = notifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);
    const unreadSignature = unreadIds.join(",");

    if (
      !unreadIds.length ||
      unreadSignature === lastMarkedNotificationIds.current ||
      unreadSignature === inFlightNotificationIds.current
    ) {
      return;
    }

    isMarkingNotifications.current = true;
    inFlightNotificationIds.current = unreadSignature;

    void markNotificationsRead(profile.id, unreadIds)
      .then(async () => {
        lastMarkedNotificationIds.current = unreadSignature;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
          }),
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
          })
        ]);
      })
      .finally(() => {
        isMarkingNotifications.current = false;
        inFlightNotificationIds.current = "";
      });
  }, [notifications, profile?.id, queryClient]);

  if (isLoading && !data) {
    return <Loader className="my-10" />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load notifications" />;
  }

  if (!notifications?.length) {
    return (
      <EmptyState
        icon={<BellIcon className="size-8" />}
        message="Inbox zero!"
      />
    );
  }

  return (
    <Card className="divide-y divide-gray-200 dark:divide-gray-800">
      {notifications.map((notification) => (
        <div
          className="flex items-start gap-2.5 p-3 md:gap-3 md:p-4"
          key={notification.id}
        >
          <div className="relative mt-0.5 shrink-0">
            {notification.actorAvatarUrl ? (
              <Image
                alt={
                  notification.actorDisplayName ||
                  notification.actorUsername ||
                  notification.title
                }
                className="size-9 rounded-full object-cover md:size-10"
                src={notification.actorAvatarUrl}
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 md:size-10 dark:bg-gray-900 dark:text-gray-300">
                {kindIconMap[notification.kind]}
              </div>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 md:-right-1 md:-bottom-1 md:size-5 dark:bg-black dark:text-gray-300 dark:ring-gray-800">
              {kindIconMap[notification.kind]}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[13px] text-gray-950 leading-5 md:text-sm dark:text-gray-50">
                  {notification.title}
                </p>
                {notification.body ? (
                  <p className="mt-0.5 text-[12px] text-gray-600 leading-4.5 md:mt-1 md:text-sm dark:text-gray-400">
                    {notification.body}
                  </p>
                ) : null}
                {notification.actorDisplayName || notification.actorUsername ? (
                  <p className="mt-0.5 text-[11px] text-gray-500 md:mt-1 md:text-xs dark:text-gray-400">
                    {notification.actorDisplayName ||
                      notification.actorUsername}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                {notification.isRead ? null : (
                  <span className="size-1.5 rounded-full bg-pink-500 md:size-2" />
                )}
                <span className="text-[11px] text-gray-500 md:text-xs dark:text-gray-400">
                  {formatRelativeOrAbsolute(notification.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
};

export default memo(List);
