import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import Loader from "@/components/Shared/Loader";
import PageLayout from "@/components/Shared/PageLayout";
import { Button, Card, ErrorMessage } from "@/components/Shared/UI";
import {
  getStaffAdminSession,
  STAFF_ADMIN_SESSION_QUERY_KEY,
  staffAdminSignOut
} from "@/helpers/staff";
import { hasSupabaseConfig } from "@/helpers/supabase";
import useStaffAdminStore from "@/store/persisted/useStaffAdminStore";
import StaffLogin from "./Login";
import Overview from "./Overview";

const Staff = () => {
  const { displayName, email, sessionToken } = useStaffAdminStore();
  const sessionQuery = useQuery({
    enabled: hasSupabaseConfig() && Boolean(sessionToken),
    queryFn: getStaffAdminSession,
    queryKey: [STAFF_ADMIN_SESSION_QUERY_KEY, sessionToken],
    retry: false,
    staleTime: 60_000
  });

  if (!hasSupabaseConfig()) {
    return (
      <PageLayout hideDesktopSidebar sidebar={null} title="Admin">
        <div className="mx-auto w-full max-w-md px-4 py-8 md:px-0">
          <Card className="p-5 md:p-6" forceRounded>
            <ErrorMessage
              error={new Error("Supabase is not configured for admin access.")}
              title="Admin panel unavailable"
            />
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (!sessionToken) {
    return (
      <PageLayout hideDesktopSidebar sidebar={null} title="Admin">
        <StaffLogin />
      </PageLayout>
    );
  }

  if (sessionQuery.isLoading) {
    return (
      <PageLayout hideDesktopSidebar sidebar={null} title="Admin">
        <div className="py-12">
          <Loader message="Checking admin access..." />
        </div>
      </PageLayout>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <PageLayout hideDesktopSidebar sidebar={null} title="Admin">
        <div className="space-y-4">
          <StaffLogin />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout hideDesktopSidebar sidebar={null} title="Admin">
      <div className="mx-auto flex w-full max-w-[92rem] justify-end px-3 pt-3 md:px-0 md:pt-5">
        <div className="flex w-full max-w-full items-center justify-between gap-2 rounded-2xl border border-gray-200/70 bg-white px-2.5 py-2 md:w-auto md:max-w-none md:justify-start md:rounded-full md:px-2 md:py-1.5 dark:border-gray-800/75 dark:bg-black">
          <div className="min-w-0 px-0.5 md:px-1">
            <p className="truncate font-semibold text-[11px] text-gray-950 md:text-[12px] dark:text-gray-50">
              {displayName || email || "Admin"}
            </p>
            <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
              {email}
            </p>
          </div>
          <Button
            className="shrink-0"
            onClick={() => void staffAdminSignOut()}
            outline
            size="sm"
          >
            <ArrowRightStartOnRectangleIcon className="size-4" />
            Sign out
          </Button>
        </div>
      </div>
      <Overview />
    </PageLayout>
  );
};

export default Staff;
