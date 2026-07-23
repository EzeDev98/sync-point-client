import { useEffect, useState } from 'react';
import { getIsOnline, onNetworkChange } from '@core/network/networkService';

/**
 * Subscribes to connectivity changes.
 * Moved from src/hooks/ and repointed at the core network service.
 */
export function useNetwork() {
  const [isOnline, setIsOnline] = useState(getIsOnline);

  useEffect(() => onNetworkChange(setIsOnline), []);

  return { isOnline, isOffline: !isOnline };
}