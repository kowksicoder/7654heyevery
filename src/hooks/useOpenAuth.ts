import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";
import { toast } from "sonner";
import { hasPrivyConfig } from "@/helpers/privy";

const useOpenAuth = () => {
  const { login } = usePrivy();

  return useCallback(
    async (trackingEvent?: string) => {
      if (trackingEvent) {
        umami.track(trackingEvent);
      }

      if (!hasPrivyConfig()) {
        toast.error("Authentication is not configured yet");
        return;
      }

      await login({ loginMethods: ["email", "wallet"] });
    },
    [login]
  );
};

export default useOpenAuth;
