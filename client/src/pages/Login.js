import { Alert, AlertIcon, Button, VStack, Text } from "@chakra-ui/react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

async function createUser(user) {
  const idToken = await user.getIdToken();
  await fetch(`${process.env.REACT_APP_API_URL || ""}/api/users/me`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phones: [], active: true }),
  });
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export default function Login({ navigateTo = "/dashboard" }) {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Process any pending redirect result first, then let onAuthStateChanged handle navigation
    getRedirectResult(auth).catch(console.error);

    // onAuthStateChanged is the single source of truth —
    // fires after popup, redirect, and on persisted session restore
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await createUser(user);
          navigate(navigateTo);
        } catch (err) {
          console.error("createUser error:", err);
        }
      }
    });
    return unsubscribe;
  }, [navigateTo, navigate]);

  const login = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      console.error("Sign-in error:", err);
      setError(`${err.code}: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <VStack spacing={6} p={10}>
      <Text fontSize="2xl" fontWeight="bold">Sign in</Text>
      <Button colorScheme="blue" onClick={login} isLoading={loading}>
        Sign in with Google
      </Button>
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}
    </VStack>
  );
}
