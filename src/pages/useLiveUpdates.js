import { Client } from "@stomp/stompjs";
import { useEffect, useRef } from "react";
import { API_BASE } from "./restaurantApi";

export function useLiveUpdates({
  enabled = true,
  token,
  subscriptions,
  onConnected,
  fallbacks = [],
}) {
  const subscriptionsRef = useRef(subscriptions);
  const onConnectedRef = useRef(onConnected);
  const fallbacksRef = useRef(fallbacks);

  const topicKey = subscriptions.map(({ destination }) => destination).join("|");
  const fallbackKey = fallbacks.map(({ intervalMs }) => intervalMs).join("|");

  useEffect(() => {
    subscriptionsRef.current = subscriptions;
    onConnectedRef.current = onConnected;
    fallbacksRef.current = fallbacks;
  }, [fallbacks, onConnected, subscriptions]);

  useEffect(() => {
    if (!enabled || !token || !topicKey) return undefined;

    let active = true;
    let fallbackTimers = [];
    const stopFallbacks = () => {
      fallbackTimers.forEach((timer) => window.clearInterval(timer));
      fallbackTimers = [];
    };
    const startFallbacks = () => {
      if (!active || fallbackTimers.length > 0) return;
      fallbackTimers = fallbacksRef.current.map((fallback, index) => {
        fallback.callback?.();
        return window.setInterval(
          () => fallbacksRef.current[index]?.callback?.(),
          fallback.intervalMs,
        );
      });
    };

    const client = new Client({
      brokerURL: `${API_BASE.replace(/^http/, "ws")}/ws`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      connectionTimeout: 10000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (!active) return;
        stopFallbacks();
        subscriptionsRef.current.forEach(({ destination }) => {
          client.subscribe(destination, (message) => {
            if (!active) return;
            const subscription = subscriptionsRef.current.find(
              (item) => item.destination === destination,
            );
            let payload;
            try {
              payload = JSON.parse(message.body);
            } catch {
              return;
            }
            subscription?.onMessage?.(payload);
          });
        });
        onConnectedRef.current?.();
      },
      onWebSocketClose: startFallbacks,
      onWebSocketError: startFallbacks,
      onStompError: startFallbacks,
    });

    client.activate();

    return () => {
      active = false;
      stopFallbacks();
      void client.deactivate();
    };
  }, [enabled, fallbackKey, token, topicKey]);
}
