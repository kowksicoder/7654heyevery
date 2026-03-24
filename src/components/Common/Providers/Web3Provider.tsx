import { PrivyProvider } from "@privy-io/react-auth";
import { createConfig, WagmiProvider } from "@privy-io/wagmi";
import type { ReactNode } from "react";
import { http } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, BRAND_COLOR, CHAIN } from "@/data/constants";
import getRpc from "@/helpers/getRpc";
import { hasPrivyConfig } from "@/helpers/privy";

const config = createConfig({
  chains: [CHAIN, base],
  transports: {
    [CHAIN.id]: getRpc(),
    [base.id]: http(BASE_RPC_URL, { batch: { batchSize: 30 } })
  }
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

interface Web3ProviderProps {
  children: ReactNode;
}

const Web3Provider = ({ children }: Web3ProviderProps) => {
  if (!hasPrivyConfig()) {
    return <WagmiProvider config={config}>{children}</WagmiProvider>;
  }

  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID as string}
      config={{
        appearance: {
          accentColor: BRAND_COLOR
        },
        defaultChain: CHAIN,
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          },
          showWalletUIs: true
        },
        loginMethods: ["wallet", "email"],
        supportedChains: [CHAIN, base]
      }}
    >
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </PrivyProvider>
  );
};

export default Web3Provider;
