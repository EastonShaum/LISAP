import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Heading, Text, VStack, Spinner, Alert, AlertIcon } from "@chakra-ui/react";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function Join() {
  const { ownerTag } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Handle redirect result on mobile after Google sign-in redirect
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await connectToOwner(result.user);
      }
    }).catch((err) => setError("Sign-in failed. Please try again."));
  }, []);

  async function connectToOwner(user) {
    const idToken = await user.getIdToken();
    const res = await fetch(
      `${process.env.REACT_APP_API_URL || ""}/api/users/me/join/${ownerTag}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Could not connect your account.");
    }
  }

  async function handleSignIn() {
    setLoading(true);
    setError(null);

    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        // Page will reload — result handled in useEffect above
        return;
      }

      const result = await signInWithPopup(auth, googleProvider);
      await connectToOwner(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Box maxW="480px" mx="auto" mt={20} p={8} bg="white" rounded="2xl" shadow="lg" textAlign="center">
      <VStack spacing={6}>
        <Heading size="lg">You're invited to LISAP</Heading>

        <Text color="gray.600">
          Someone shared their streaming account with you. Sign in with Google and you'll
          automatically receive push notifications whenever a login code comes through —
          no extra setup needed.
        </Text>

        {error && (
          <Alert status="error" borderRadius="md" textAlign="left">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <Button
          colorScheme="blue"
          size="lg"
          width="full"
          onClick={handleSignIn}
          isLoading={loading}
          loadingText="Connecting..."
        >
          Sign in with Google
        </Button>

        <Text fontSize="xs" color="gray.400">
          By signing in you agree to receive push notifications for shared account login codes.
        </Text>
      </VStack>
    </Box>
  );
}
