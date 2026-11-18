import { useEffect, useState } from "react";
import { Box, Button, CloseButton, HStack, Icon, Link, Text, VStack, Alert, AlertIcon } from "@chakra-ui/react";
import { auth, registerFCMToken } from "../firebase";

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;

export default function Dashboard() {
  const [notifStatus, setNotifStatus] = useState(null); // "granted" | "denied" | "error" | null
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSBanner, setShowIOSBanner] = useState(isIOS);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    async function setupPushNotifications() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

      try {
        // Register the service worker
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // Send Firebase config to the SW so it can initialize
        const config = {
          apiKey: process.env.REACT_APP_FIREBASE_APIKEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID,
        };
        registration.active?.postMessage({ type: "FIREBASE_CONFIG", config });

        // Get the current user's ID token and register the FCM device token
        const user = auth.currentUser;
        if (!user) return;
        const idToken = await user.getIdToken();
        await registerFCMToken(idToken);

        setNotifStatus(Notification.permission);
      } catch (err) {
        console.error("Push notification setup failed:", err);
        setNotifStatus("error");
      }
    }

    setupPushNotifications();
  }, []);

  return (
    <>
    <VStack spacing={6} p={6} textAlign="center">
      <Text fontSize="2xl" fontWeight="bold">
        Welcome to Your Dashboard
      </Text>
      <Text color="gray.600">
        Below are the Streaming Services and phone numbers you are currently using
      </Text>

      {notifStatus === "denied" && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          Notifications are blocked. Enable them in your browser settings to receive OTP alerts.
        </Alert>
      )}
      {notifStatus === "error" && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          Could not set up push notifications. Please refresh and try again.
        </Alert>
      )}
      {notifStatus === "granted" && (
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          Push notifications are enabled on this device.
        </Alert>
      )}

      {installPrompt && (
        <Button
          colorScheme="blue"
          onClick={async () => {
            installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === "accepted") setInstallPrompt(null);
          }}
        >
          Install App
        </Button>
      )}

      <Link href="/managephones">
        Manage Phones/Services
      </Link>
    </VStack>

    {showIOSBanner && (
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="white"
        borderTop="1px solid"
        borderColor="gray.200"
        boxShadow="0 -2px 12px rgba(0,0,0,0.12)"
        p={4}
        zIndex={1000}
      >
        <HStack justify="space-between" align="flex-start">
          <VStack align="flex-start" spacing={1} flex={1}>
            <Text fontWeight="semibold" fontSize="sm">Install LISAP</Text>
            <Text fontSize="sm" color="gray.600">
              Tap the <Text as="span" fontWeight="bold">Share</Text> button{" "}
              <Text as="span" fontSize="md">⎙</Text> then{" "}
              <Text as="span" fontWeight="bold">Add to Home Screen</Text> to install the app.
            </Text>
          </VStack>
          <CloseButton onClick={() => setShowIOSBanner(false)} />
        </HStack>
      </Box>
    )}
    </>
  );
}