import { onError } from "@apollo/client/link/error";
import {
  clearAuthTokens,
  hydrateAuthTokens
} from "@/store/persisted/useAuthStore";

const isOnboardingUserBalanceError = (message?: null | string) => {
  if (!message) {
    return false;
  }

  return (
    message.includes("balancesBulk") && message.includes("ONBOARDING_USER")
  );
};

const clearOnboardingTokens = () => {
  const { accessToken, refreshToken } = hydrateAuthTokens();

  if (!accessToken && !refreshToken) {
    return;
  }

  clearAuthTokens();
};

const errorLink = onError(({ graphQLErrors, networkError }) => {
  const graphQlMessages =
    graphQLErrors?.map((error) => error.message).filter(Boolean) || [];
  const networkErrorMessage =
    networkError && "message" in networkError ? networkError.message : null;
  const shouldClearAuth =
    graphQlMessages.some(isOnboardingUserBalanceError) ||
    isOnboardingUserBalanceError(networkErrorMessage);

  if (shouldClearAuth) {
    clearOnboardingTokens();
  }
});

export default errorLink;
