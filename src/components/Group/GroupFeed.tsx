import {
  ChatBubbleBottomCenterIcon,
  PaperAirplaneIcon
} from "@heroicons/react/24/outline";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_AVATAR } from "@/data/constants";
import cn from "@/helpers/cn";
import { getSupabaseClient, hasSupabaseConfig } from "@/helpers/supabase";
import useOpenAuth from "@/hooks/useOpenAuth";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type {
  Every1CommunityChatMessage,
  Every1CommunityChatMutationResult,
  Every1CommunityDetails
} from "@/types/every1";
import { Button, Card, EmptyState, ErrorMessage, Image } from "../Shared/UI";

interface GroupFeedProps {
  community: Every1CommunityDetails;
}

const COMMUNITY_CHAT_QUERY_KEY = "every1-community-chat";

const getDayLabel = (value: string) => {
  const date = dayjs(value);

  if (date.isSame(dayjs(), "day")) {
    return "Today";
  }

  if (date.isSame(dayjs().subtract(1, "day"), "day")) {
    return "Yesterday";
  }

  return date.format("MMM D, YYYY");
};

const getAuthorLabel = (message: Every1CommunityChatMessage) =>
  message.authorDisplayName || message.authorUsername || "Community member";

const GroupFeed = ({ community }: GroupFeedProps) => {
  const queryClient = useQueryClient();
  const openAuth = useOpenAuth();
  const { profile } = useEvery1Store();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<null | RealtimeChannel>(null);
  const typingTimeoutRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  const guestPresenceKeyRef = useRef(
    `viewer:${Math.random().toString(36).slice(2, 10)}`
  );
  const [draft, setDraft] = useState("");
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const canChat = Boolean(
    profile?.id &&
      (community.isOwner || community.membershipStatus === "active")
  );
  const canViewChat = community.visibility === "public" || canChat;
  const presenceKey =
    profile?.id ||
    profile?.walletAddress?.trim().toLowerCase() ||
    guestPresenceKeyRef.current;

  const chatQuery = useQuery({
    enabled: hasSupabaseConfig() && Boolean(community.id),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc(
        "list_community_chat_messages",
        {
          input_community_id: community.id,
          input_limit: 180,
          input_viewer_profile_id: profile?.id || null
        }
      );

      if (error) {
        throw error;
      }

      return ((data || []) as Array<Record<string, unknown>>).map(
        (message): Every1CommunityChatMessage => ({
          authorAvatarUrl: (message.author_avatar_url as null | string) || null,
          authorDisplayName:
            (message.author_display_name as null | string) || null,
          authorProfileId: String(message.author_profile_id),
          authorUsername: (message.author_username as null | string) || null,
          body: String(message.body || ""),
          communityId: String(message.community_id),
          createdAt: String(message.created_at),
          id: String(message.id)
        })
      );
    },
    queryKey: [COMMUNITY_CHAT_QUERY_KEY, community.id, profile?.id || null]
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error("missing_profile");
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc(
        "create_community_chat_message",
        {
          input_author_profile_id: profile.id,
          input_body: draft,
          input_community_id: community.id
        }
      );

      if (error) {
        throw error;
      }

      return data as Every1CommunityChatMutationResult;
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "missing_profile") {
        return;
      }

      toast.error("Unable to send message", {
        description:
          error instanceof Error ? error.message : "Please try again."
      });
    },
    onSuccess: async (result) => {
      if (!result.created) {
        toast.error("Unable to send message", {
          description:
            result.reason === "membership_required"
              ? "Join this community before sending messages."
              : result.reason === "empty_message"
                ? "Write something first."
                : "Please try again."
        });
        return;
      }

      setDraft("");
      setIsTyping(false);
      await queryClient.invalidateQueries({
        queryKey: [COMMUNITY_CHAT_QUERY_KEY, community.id]
      });
    }
  });

  useEffect(() => {
    if (!canViewChat || !hasSupabaseConfig()) {
      return;
    }

    const supabase = getSupabaseClient();
    const channel = supabase.channel(`community-chat:${community.id}`, {
      config: {
        presence: { key: presenceKey }
      }
    });

    const syncPresence = () => {
      const presenceState = channel.presenceState();
      const activeUsers = Object.values(presenceState).flatMap((entries) =>
        Array.isArray(entries) ? entries : []
      ) as Array<Record<string, unknown>>;

      setOnlineCount(Object.keys(presenceState).length);
      setTypingUsers(
        activeUsers
          .filter(
            (entry) =>
              Boolean(entry.typing) &&
              String(entry.profileId || entry.walletAddress || "") !==
                String(profile?.id || profile?.walletAddress || "")
          )
          .map((entry) =>
            String(
              entry.displayName ||
                entry.username ||
                entry.walletAddress ||
                "Someone"
            )
          )
      );
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `community_id=eq.${community.id}`,
          schema: "public",
          table: "community_chat_messages"
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: [COMMUNITY_CHAT_QUERY_KEY, community.id]
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeReady(true);
          syncPresence();
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "CLOSED" ||
          status === "TIMED_OUT"
        ) {
          setIsRealtimeReady(false);
          setOnlineCount(0);
          setTypingUsers([]);
        }
      });

    channelRef.current = channel;

    return () => {
      setIsRealtimeReady(false);
      setOnlineCount(0);
      setTypingUsers([]);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    canViewChat,
    community.id,
    presenceKey,
    profile?.id,
    profile?.walletAddress,
    queryClient
  ]);

  useEffect(() => {
    const channel = channelRef.current;

    if (!channel || !isRealtimeReady || !canChat) {
      return;
    }

    void channel.track({
      communityId: community.id,
      displayName: profile?.displayName || null,
      joinedAt: new Date().toISOString(),
      profileId: profile?.id || null,
      typing: isTyping,
      username: profile?.username || null,
      walletAddress: profile?.walletAddress?.trim().toLowerCase() || null
    });
  }, [
    canChat,
    community.id,
    isRealtimeReady,
    isTyping,
    profile?.displayName,
    profile?.id,
    profile?.username,
    profile?.walletAddress
  ]);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight;
  }, [chatQuery.data]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    []
  );

  const groupedMessages = useMemo(() => {
    const items = chatQuery.data || [];
    const grouped: Array<
      | { kind: "date"; label: string }
      | { kind: "message"; message: Every1CommunityChatMessage }
    > = [];

    let previousDay = "";

    for (const message of items) {
      const nextDay = dayjs(message.createdAt).format("YYYY-MM-DD");

      if (nextDay !== previousDay) {
        previousDay = nextDay;
        grouped.push({ kind: "date", label: getDayLabel(message.createdAt) });
      }

      grouped.push({ kind: "message", message });
    }

    return grouped;
  }, [chatQuery.data]);

  const typingCopy = useMemo(() => {
    const uniqueUsers = [...new Set(typingUsers.filter(Boolean))];

    if (!uniqueUsers.length) {
      return null;
    }

    if (uniqueUsers.length === 1) {
      return `${uniqueUsers[0]} is typing...`;
    }

    if (uniqueUsers.length === 2) {
      return `${uniqueUsers[0]} and ${uniqueUsers[1]} are typing...`;
    }

    return `${uniqueUsers[0]} and ${uniqueUsers.length - 1} others are typing...`;
  }, [typingUsers]);

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (!canChat) {
      return;
    }

    setIsTyping(Boolean(value.trim()));

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  const handleSend = async () => {
    if (!profile?.id) {
      await openAuth("community_chat_open_auth");
      return;
    }

    if (!canChat) {
      toast.error("Join the community first", {
        description: "Only active members can chat here."
      });
      return;
    }

    if (!draft.trim()) {
      return;
    }

    await sendMessageMutation.mutateAsync();
  };

  return (
    <div id="community-feed">
      <Card className="overflow-hidden" forceRounded>
        <div className="border-gray-200 border-b px-4 py-4 md:px-5 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-950 text-sm dark:text-white">
                Community chat
              </div>
              <div className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                {onlineCount} online
                {isRealtimeReady ? " • live now" : " • reconnecting"}
              </div>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:bg-gray-900 dark:text-gray-400">
              members chat
            </span>
          </div>
          {typingCopy ? (
            <div className="mt-2 text-emerald-600 text-xs dark:text-emerald-400">
              {typingCopy}
            </div>
          ) : null}
        </div>

        {canViewChat ? (
          chatQuery.isLoading ? (
            <div className="space-y-3 px-4 py-5 md:px-5">
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />
            </div>
          ) : chatQuery.error ? (
            <div className="px-4 py-5 md:px-5">
              <ErrorMessage
                error={chatQuery.error}
                title="Failed to load community chat"
              />
            </div>
          ) : groupedMessages.length ? (
            <div
              className="max-h-[32rem] space-y-4 overflow-y-auto px-4 py-4 md:px-5"
              ref={scrollContainerRef}
            >
              {groupedMessages.map((entry, index) =>
                entry.kind === "date" ? (
                  <div
                    className="flex items-center gap-3"
                    key={`date-${entry.label}-${index}`}
                  >
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                    <span className="shrink-0 text-[11px] text-gray-400 uppercase tracking-[0.16em] dark:text-gray-500">
                      {entry.label}
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                  </div>
                ) : (
                  (() => {
                    const isOwnMessage =
                      entry.message.authorProfileId === profile?.id;

                    return (
                      <div
                        className={cn(
                          "flex gap-3",
                          isOwnMessage ? "justify-end" : "justify-start"
                        )}
                        key={entry.message.id}
                      >
                        {isOwnMessage ? null : (
                          <Image
                            alt={getAuthorLabel(entry.message)}
                            className="mt-1 size-9 rounded-full object-cover"
                            src={
                              entry.message.authorAvatarUrl || DEFAULT_AVATAR
                            }
                          />
                        )}

                        <div
                          className={cn(
                            "min-w-0 max-w-[85%] space-y-1",
                            isOwnMessage
                              ? "items-end text-right"
                              : "items-start text-left"
                          )}
                        >
                          <div className="text-gray-500 text-xs dark:text-gray-400">
                            {isOwnMessage
                              ? "You"
                              : getAuthorLabel(entry.message)}{" "}
                            • {dayjs(entry.message.createdAt).format("h:mm A")}
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-3 text-sm leading-6",
                              isOwnMessage
                                ? "rounded-tr-md bg-gray-950 text-white dark:bg-white dark:text-black"
                                : "rounded-tl-md bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
                            )}
                          >
                            {entry.message.body}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )
              )}
            </div>
          ) : (
            <div className="px-4 py-6 md:px-5">
              <EmptyState
                hideCard
                icon={<ChatBubbleBottomCenterIcon className="size-8" />}
                message="No messages yet. Start the community conversation."
              />
            </div>
          )
        ) : (
          <div className="px-4 py-5 md:px-5">
            <ErrorMessage
              error={
                new Error(
                  "This private community chat is only visible to members."
                )
              }
              title="Chat unavailable"
            />
          </div>
        )}

        <div className="border-gray-200 border-t bg-gray-50/80 px-4 py-4 backdrop-blur-sm md:px-5 dark:border-gray-800 dark:bg-black/70">
          {canChat ? (
            <div className="flex items-end gap-3">
              <textarea
                className="max-h-32 min-h-[52px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-950 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={`Message ${community.name}`}
                rows={1}
                value={draft}
              />
              <Button
                className="shrink-0"
                disabled={!draft.trim()}
                icon={<PaperAirplaneIcon className="size-4" />}
                loading={sendMessageMutation.isPending}
                onClick={() => void handleSend()}
                size="sm"
              >
                Send
              </Button>
            </div>
          ) : profile?.id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-gray-500 text-sm dark:text-gray-400">
                Join the community to send messages in the live chatroom.
              </div>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 text-xs dark:border-gray-800 dark:text-gray-400">
                view only
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-gray-500 text-sm dark:text-gray-400">
                Sign in and join the community to start chatting.
              </div>
              <Button
                onClick={() => void openAuth("community_chat_open_auth")}
                size="sm"
              >
                Log in to chat
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default GroupFeed;
