const getCoinPath = (address?: null | string) => {
  const normalizedAddress = address?.trim().toLowerCase();

  return normalizedAddress ? `/coins/${normalizedAddress}` : "";
};

export default getCoinPath;
