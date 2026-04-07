"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import {
  decodeVapidPublicKey,
  getAppServiceWorkerRegistration,
  supportsPushNotifications,
} from "@/lib/pwa/service-worker";

type AdminPushState = "idle" | "checking" | "subscribing" | "subscribed" | "needs_permission" | "error";

async function saveAdminPushSubscription(subscription: PushSubscription) {
  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;

  if (!serialized.endpoint || !p256dh || !auth) {
    throw new Error("Push subscription is missing required keys.");
  }

  const response = await fetch("/api/admin/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      endpoint: serialized.endpoint,
      expirationTime: serialized.expirationTime ?? null,
      keys: {
        p256dh,
        auth,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Unable to save the admin notification subscription.");
  }
}

export function AdminPushSubscriptionControl() {
  const [pushState, setPushState] = useState<AdminPushState>("checking");
  const [message, setMessage] = useState("Checking notification setup...");

  useEffect(() => {
    let cancelled = false;

    const syncExistingSubscription = async () => {
      if (!supportsPushNotifications()) {
        if (!cancelled) {
          setPushState("error");
          setMessage("This browser does not support push notifications.");
        }
        return;
      }

      if (!publicEnv.webPushVapidPublicKey) {
        if (!cancelled) {
          setPushState("error");
          setMessage("Push alerts are not configured for this environment yet.");
        }
        return;
      }

      if (!cancelled) {
        setPushState("checking");
        setMessage("Checking notification setup...");
      }

      try {
        const registration = await getAppServiceWorkerRegistration();
        if (!registration) {
          throw new Error("Service worker registration is unavailable.");
        }

        if (Notification.permission !== "granted") {
          if (!cancelled) {
            setPushState("needs_permission");
            setMessage(
              Notification.permission === "denied"
                ? "Notifications are blocked in this browser. Allow them in site settings to receive paid-order alerts."
                : "Allow notifications to receive paid-order alerts on this device.",
            );
          }
          return;
        }

        const existingSubscription = await registration.pushManager.getSubscription();
        if (!existingSubscription) {
          if (!cancelled) {
            setPushState("idle");
            setMessage("Notifications are allowed. Finish setup to receive paid-order alerts.");
          }
          return;
        }

        await saveAdminPushSubscription(existingSubscription);

        if (!cancelled) {
          setPushState("subscribed");
          setMessage("Paid-order alerts are active on this device.");
        }
      } catch (error) {
        if (!cancelled) {
          setPushState("error");
          setMessage(error instanceof Error ? error.message : "Unable to set up admin push notifications.");
        }
      }
    };

    void syncExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    if (!supportsPushNotifications()) {
      setPushState("error");
      setMessage("This browser does not support push notifications.");
      return;
    }

    if (!publicEnv.webPushVapidPublicKey) {
      setPushState("error");
      setMessage("Push alerts are not configured for this environment yet.");
      return;
    }

    setPushState("subscribing");
    setMessage("Enabling paid-order alerts...");

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setPushState("needs_permission");
        setMessage(
          permission === "denied"
            ? "Notifications are blocked in this browser. Allow them in site settings to receive paid-order alerts."
            : "Allow notifications to finish setting up paid-order alerts.",
        );
        return;
      }

      const registration = await getAppServiceWorkerRegistration();
      if (!registration) {
        throw new Error("Service worker registration is unavailable.");
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicEnv.webPushVapidPublicKey),
        });

      await saveAdminPushSubscription(subscription);

      setPushState("subscribed");
      setMessage("Paid-order alerts are active on this device.");
    } catch (error) {
      setPushState("error");
      setMessage(error instanceof Error ? error.message : "Unable to enable paid-order alerts.");
    }
  };

  const showButton = pushState !== "subscribed";
  const buttonLabel =
    pushState === "subscribing"
      ? "Enabling alerts..."
      : pushState === "idle"
        ? "Finish setup"
        : pushState === "error"
          ? "Retry setup"
          : "Enable push alerts";

  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-kira-red shadow-sm">
          {pushState === "subscribed" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Paid order push alerts</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{message}</p>
          {showButton ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant={pushState === "error" ? "outline" : "default"}
                loading={pushState === "checking" || pushState === "subscribing"}
                onClick={() => void handleSubscribe()}
              >
                {buttonLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
