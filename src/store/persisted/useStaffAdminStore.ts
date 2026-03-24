import { Localstorage } from "@/data/storage";
import { createPersistedTrackedStore } from "@/store/createTrackedStore";
import type { StaffAdminSession } from "@/types/staff";

interface State {
  adminId: null | string;
  displayName: null | string;
  email: null | string;
  sessionToken: null | string;
  setSession: (session: StaffAdminSession) => void;
  signOut: () => void;
}

if (typeof window !== "undefined") {
  window.localStorage.removeItem("staff-admin.store");
}

const { store, useStore: useStaffAdminStore } =
  createPersistedTrackedStore<State>(
    (set) => ({
      adminId: null,
      displayName: null,
      email: null,
      sessionToken: null,
      setSession: (session) =>
        set({
          adminId: session.adminId,
          displayName: session.displayName,
          email: session.email,
          sessionToken: session.sessionToken
        }),
      signOut: () =>
        set({
          adminId: null,
          displayName: null,
          email: null,
          sessionToken: null
        })
    }),
    { name: Localstorage.StaffAdminStore }
  );

export const getStaffAdminSessionToken = () => store.getState().sessionToken;

export const setStaffAdminSession = (session: StaffAdminSession) =>
  store.getState().setSession(session);

export const clearStaffAdminSession = () => store.getState().signOut();

export default useStaffAdminStore;
