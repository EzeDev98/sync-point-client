// Subscribes to connectivity changes.
import { useEffect, useState } from 'react';
import { getIsOnline, onNetworkChange } from '@core/network/networkService';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(getIsOnline);

  useEffect(() => onNetworkChange(setIsOnline), []);

  return { isOnline, isOffline: !isOnline };
}
