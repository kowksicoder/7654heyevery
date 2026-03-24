import { PlusIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button, Card, Input, Modal, TextArea } from "@/components/Shared/UI";
import {
  createCommunity,
  EVERY1_COMMUNITIES_QUERY_KEY
} from "@/helpers/every1";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const CreateCommunity = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useEvery1Store();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const createCommunityMutation = useMutation({
    mutationFn: async () =>
      await createCommunity({
        description,
        name,
        ownerProfileId: profile?.id as string,
        slug
      }),
    onError: (error) => {
      toast.error("Failed to create community", {
        description:
          error instanceof Error ? error.message : "Please try again."
      });
    },
    onSuccess: async (result) => {
      toast.success("Community created", {
        description: "Your group is ready for members and posts."
      });
      setShowModal(false);
      setName("");
      setSlug("");
      setDescription("");
      await queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITIES_QUERY_KEY]
      });
      if (result.slug) {
        navigate(`/g/${result.slug}`);
      }
    }
  });

  if (!profile?.id) {
    return null;
  }

  return (
    <>
      <Card className="space-y-4 p-5" forceRounded>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-gray-950 text-sm dark:text-white">
              <UserGroupIcon className="size-4" />
              Create community
            </div>
            <p className="text-gray-600 text-sm dark:text-gray-400">
              Start a focused space for members, posts, and updates.
            </p>
          </div>
          <Button
            className="shrink-0"
            icon={<PlusIcon className="size-4" />}
            onClick={() => setShowModal(true)}
            size="sm"
          >
            New
          </Button>
        </div>
      </Card>
      <Modal
        onClose={() => setShowModal(false)}
        show={showModal}
        title="Create community"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Every1 Music"
            value={name}
          />
          <Input
            label="Slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="every1-music"
            value={slug}
          />
          <TextArea
            className="min-h-28 px-3 py-2"
            label="Description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What brings this community together?"
            value={description}
          />
          <div className="flex justify-end">
            <Button
              disabled={!name.trim()}
              loading={createCommunityMutation.isPending}
              onClick={() => createCommunityMutation.mutate()}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CreateCommunity;
