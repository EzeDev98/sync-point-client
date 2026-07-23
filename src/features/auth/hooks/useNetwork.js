import { useState, useEffect } from "react";
import { getIsOnline, onNetworkChange } from "../../../services/networkService";

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(getIsOnline);

  useEffect(() => {
    return onNetworkChange(setIsOnline);
  }, []);

  return { isOnline, isOffline: !isOnline };
}