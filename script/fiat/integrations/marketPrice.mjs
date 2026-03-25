import { assert } from "../utils.mjs";

const normalizePositiveNumber = (value) => {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const createMarketPriceClient = ({
  ethNgnOverride = null,
  ethUsdOverride = null,
  ethUsdSpotUrl = "https://api.coinbase.com/v2/prices/ETH-USD/spot",
  ngnPerUsd = 1600
}) => {
  const getEthUsdPrice = async () => {
    const override = normalizePositiveNumber(ethUsdOverride);

    if (override) {
      return override;
    }

    const response = await fetch(ethUsdSpotUrl, {
      headers: {
        accept: "application/json"
      }
    });

    assert(response.ok, "Unable to load the ETH/USD spot price.", 503);

    const payload = await response.json();
    const amount = normalizePositiveNumber(payload?.data?.amount);

    assert(amount, "The ETH/USD spot price response was invalid.", 503);
    return amount;
  };

  const getEthNgnPrice = async () => {
    const directOverride = normalizePositiveNumber(ethNgnOverride);

    if (directOverride) {
      return directOverride;
    }

    const normalizedNgnPerUsd = normalizePositiveNumber(ngnPerUsd) || 1600;
    const ethUsdPrice = await getEthUsdPrice();
    return ethUsdPrice * normalizedNgnPerUsd;
  };

  return {
    getEthNgnPrice,
    getEthUsdPrice
  };
};
