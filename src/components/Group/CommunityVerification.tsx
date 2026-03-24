import {
  ClipboardDocumentIcon,
  ShieldCheckIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Modal,
  Select,
  TextArea
} from "@/components/Shared/UI";
import errorToast from "@/helpers/errorToast";
import {
  confirmCommunityVerificationAdmin,
  EVERY1_COMMUNITIES_QUERY_KEY,
  EVERY1_COMMUNITY_QUERY_KEY,
  EVERY1_COMMUNITY_VERIFICATION_CONFIRMATIONS_QUERY_KEY,
  EVERY1_COMMUNITY_VERIFICATION_QUERY_KEY,
  getCommunityVerificationContext,
  listCommunityVerificationConfirmations,
  submitCommunityVerificationRequest
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import useOpenAuth from "@/hooks/useOpenAuth";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type { Every1CommunityDetails } from "@/types/every1";

const statusCopy: Record<
  Every1CommunityDetails["verificationStatus"],
  { label: string; className: string }
> = {
  flagged: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-300",
    label: "Needs review"
  },
  pending: {
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/30 dark:text-blue-300",
    label: "Pending verification"
  },
  rejected: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/80 dark:bg-red-950/30 dark:text-red-300",
    label: "Not approved"
  },
  unverified: {
    className:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
    label: "Not verified yet"
  },
  verified: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-300",
    label: "Verified community"
  }
};

const verificationKindOptions = [
  { label: "Official community", value: "official" },
  { label: "Community-led", value: "community_led" }
] as const;

const groupPlatformOptions = [
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Telegram", value: "telegram" },
  { label: "Other", value: "other" }
] as const;

interface CommunityVerificationProps {
  community: Every1CommunityDetails;
}

const CommunityVerification = ({ community }: CommunityVerificationProps) => {
  const { profile } = useEvery1Store();
  const openAuth = useOpenAuth();
  const queryClient = useQueryClient();
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [verificationKind, setVerificationKind] = useState<
    "community_led" | "official"
  >("community_led");
  const [category, setCategory] = useState("Campus");
  const [groupPlatform, setGroupPlatform] = useState<
    "other" | "telegram" | "whatsapp"
  >("whatsapp");
  const [groupUrl, setGroupUrl] = useState("");
  const [note, setNote] = useState("");
  const [adminIdentifiers, setAdminIdentifiers] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const contextQuery = useQuery({
    enabled: hasSupabaseConfig() && Boolean(community.id),
    queryFn: () =>
      getCommunityVerificationContext({
        communityId: community.id,
        viewerProfileId: profile?.id || null
      }),
    queryKey: [
      EVERY1_COMMUNITY_VERIFICATION_QUERY_KEY,
      community.id,
      profile?.id || null
    ]
  });

  const confirmationsQuery = useQuery({
    enabled: Boolean(contextQuery.data?.requestId),
    queryFn: () =>
      listCommunityVerificationConfirmations(
        contextQuery.data?.requestId as string
      ),
    queryKey: [
      EVERY1_COMMUNITY_VERIFICATION_CONFIRMATIONS_QUERY_KEY,
      contextQuery.data?.requestId || null
    ]
  });

  const invalidateCommunityQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITY_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITIES_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITY_VERIFICATION_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITY_VERIFICATION_CONFIRMATIONS_QUERY_KEY]
      })
    ]);
  };

  const requestSummary = contextQuery.data;
  const confirmationRows = confirmationsQuery.data || [];
  const inviteExamples = useMemo(
    () =>
      verificationKind === "official"
        ? "classrep\nassistantrep\nunilagcscaptain"
        : "hostelpresident\ncommunitylead",
    [verificationKind]
  );

  const handleCopyCode = async () => {
    if (!requestSummary?.verificationCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(requestSummary.verificationCode);
      toast.success("Verification code copied");
    } catch {
      toast.error("Could not copy the verification code");
    }
  };

  const handleClaim = async () => {
    if (!profile?.id) {
      openAuth();
      return;
    }

    setIsSubmitting(true);

    try {
      await submitCommunityVerificationRequest({
        adminIdentifiers: adminIdentifiers
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        category,
        communityId: community.id,
        groupPlatform,
        groupUrl,
        note,
        requesterProfileId: profile.id,
        verificationKind
      });

      await invalidateCommunityQueries();
      setShowClaimModal(false);
      toast.success("Community verification request submitted");
    } catch (error) {
      errorToast(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!profile?.id || !requestSummary?.requestId) {
      openAuth();
      return;
    }

    setIsConfirming(true);

    try {
      await confirmCommunityVerificationAdmin({
        profileId: profile.id,
        requestId: requestSummary.requestId
      });
      await invalidateCommunityQueries();
      toast.success("Community verification confirmed");
    } catch (error) {
      errorToast(error);
    } finally {
      setIsConfirming(false);
    }
  };

  const openClaimModal = () => {
    if (!profile?.id) {
      openAuth();
      return;
    }

    setVerificationKind(
      requestSummary?.verificationKind ||
        community.verificationKind ||
        "community_led"
    );
    setCategory(requestSummary?.category || category);
    setGroupPlatform(requestSummary?.groupPlatform || "whatsapp");
    setGroupUrl(requestSummary?.groupUrl || "");
    setNote(requestSummary?.note || "");
    setAdminIdentifiers(
      confirmationRows
        .filter((confirmation) => confirmation.roleLabel !== "owner")
        .map(
          (confirmation) =>
            confirmation.username ||
            confirmation.invitedIdentifier ||
            confirmation.walletAddress ||
            ""
        )
        .filter(Boolean)
        .join("\n")
    );
    setShowClaimModal(true);
  };

  const canClaim =
    community.isOwner && community.verificationStatus !== "verified";
  const canConfirm = Boolean(requestSummary?.viewerCanConfirm);

  return (
    <>
      <div id="community-verification">
        <Card className="mx-5 mb-4 rounded-[1.35rem] border border-gray-200/80 p-4 md:mx-0 dark:border-gray-800/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                  Community verification
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-semibold text-[11px] ${statusCopy[community.verificationStatus].className}`}
                >
                  {statusCopy[community.verificationStatus].label}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-gray-600 text-sm leading-6 dark:text-gray-300">
                Verified communities earn the trust badge after multiple admins
                confirm ownership and staff reviews the request.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canConfirm ? (
                <Button
                  disabled={isConfirming}
                  onClick={handleConfirm}
                  size="sm"
                >
                  Confirm admin
                </Button>
              ) : null}
              {canClaim ? (
                <Button onClick={openClaimModal} outline size="sm">
                  {requestSummary ? "Update request" : "Claim verification"}
                </Button>
              ) : null}
            </div>
          </div>

          {contextQuery.isLoading ? (
            <p className="mt-4 text-gray-500 text-sm dark:text-gray-400">
              Loading verification status...
            </p>
          ) : contextQuery.error ? (
            <div className="mt-4">
              <ErrorMessage
                error={contextQuery.error}
                title="Failed to load community verification"
              />
            </div>
          ) : requestSummary ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-gray-800/70 dark:bg-gray-900/80">
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Type
                  </p>
                  <p className="mt-1 font-semibold text-gray-950 text-sm capitalize dark:text-gray-50">
                    {requestSummary.verificationKind === "official"
                      ? "Official community"
                      : "Community-led"}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-gray-800/70 dark:bg-gray-900/80">
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Admin confirmations
                  </p>
                  <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {requestSummary.confirmedAdminCount}/
                    {requestSummary.requiredAdminCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 dark:border-gray-800/70 dark:bg-gray-900/80">
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Proof code
                  </p>
                  <button
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-gray-950 text-sm transition-colors hover:text-gray-600 dark:text-gray-50 dark:hover:text-gray-200"
                    onClick={handleCopyCode}
                    type="button"
                  >
                    {requestSummary.verificationCode}
                    <ClipboardDocumentIcon className="size-4" />
                  </button>
                </div>
              </div>

              {requestSummary.note ? (
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 py-3 text-gray-600 text-sm leading-6 dark:border-gray-800/70 dark:bg-gray-900/80 dark:text-gray-300">
                  {requestSummary.note}
                </div>
              ) : null}

              {requestSummary.adminNote ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-700 text-sm leading-6 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
                  Admin note: {requestSummary.adminNote}
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200/80 p-3 dark:border-gray-800/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    Admin confirmations
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Invite {requestSummary.requiredAdminCount - 1} more admins
                    plus yourself
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {confirmationsQuery.isLoading ? (
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                      Loading invited admins...
                    </p>
                  ) : confirmationsQuery.error ? (
                    <ErrorMessage
                      error={confirmationsQuery.error}
                      title="Failed to load admin confirmations"
                    />
                  ) : confirmationRows.length ? (
                    confirmationRows.map((confirmation) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/75 bg-gray-50/70 px-3 py-2.5 dark:border-gray-800/70 dark:bg-gray-900/70"
                        key={confirmation.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-950 text-sm dark:text-gray-50">
                            {confirmation.displayName ||
                              confirmation.username ||
                              confirmation.walletAddress ||
                              confirmation.invitedIdentifier ||
                              "Invited admin"}
                          </p>
                          <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                            {confirmation.roleLabel || "admin"}
                          </p>
                        </div>
                        <span
                          className={
                            confirmation.status === "confirmed"
                              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-[11px] text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                          }
                        >
                          {confirmation.status === "confirmed"
                            ? "confirmed"
                            : "pending"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                      No invited admins yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-gray-200 border-dashed px-4 py-4 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="mt-0.5 size-5 text-gray-400" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
                    No verification request yet
                  </p>
                  <p className="mt-1 text-gray-500 text-sm leading-6 dark:text-gray-400">
                    Community verification starts with multiple admin
                    confirmations. Once approved, this community gets the
                    verified badge across Every1.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        onClose={() => setShowClaimModal(false)}
        show={showClaimModal}
        size="md"
        title="Claim community verification"
      >
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-blue-700 text-sm leading-6 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
            Official communities need{" "}
            {verificationKind === "official" ? "3" : "2"} confirmed admins,
            including you. Use usernames, wallet addresses, or Zora handles for
            the invited admins.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
                Verification type
              </p>
              <Select
                defaultValue={verificationKind}
                onChange={(value) =>
                  setVerificationKind(value as "community_led" | "official")
                }
                options={verificationKindOptions.map((option) => ({
                  label: option.label,
                  selected: option.value === verificationKind,
                  value: option.value
                }))}
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
                Category
              </p>
              <Input
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Campus, hostel, church..."
                value={category}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
                Group platform
              </p>
              <Select
                defaultValue={groupPlatform}
                onChange={(value) =>
                  setGroupPlatform(value as "other" | "telegram" | "whatsapp")
                }
                options={groupPlatformOptions.map((option) => ({
                  label: option.label,
                  selected: option.value === groupPlatform,
                  value: option.value
                }))}
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
                Group link
              </p>
              <Input
                onChange={(event) => setGroupUrl(event.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                value={groupUrl}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
              Invite admins
            </p>
            <TextArea
              className="min-h-28"
              onChange={(event) => setAdminIdentifiers(event.target.value)}
              placeholder={inviteExamples}
              value={adminIdentifiers}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Add one username, wallet, or handle per line.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-gray-700 text-sm dark:text-gray-300">
              Why should this community be verified?
            </p>
            <TextArea
              className="min-h-24"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Tell the team who this community represents and how the invited admins are connected."
              value={note}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => setShowClaimModal(false)}
              outline
              size="sm"
              type="button"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleClaim}
              size="sm"
              type="button"
            >
              <UserPlusIcon className="mr-1 size-4" />
              Submit request
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CommunityVerification;
