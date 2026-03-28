import type { ApolloLink } from "@apollo/client";
import { ApolloClient, from } from "@apollo/client";
import cache from "./cache";
import errorLink from "./errorLink";
import httpLink from "./httpLink";
import retryLink from "./retryLink";

export const createApolloClient = (authLink?: ApolloLink) =>
  new ApolloClient({
    cache,
    devtools: {
      enabled: true
    },
    link: authLink
      ? from([authLink, errorLink, retryLink, httpLink])
      : from([errorLink, retryLink, httpLink])
  });

const apolloClient = createApolloClient();

export default apolloClient;
