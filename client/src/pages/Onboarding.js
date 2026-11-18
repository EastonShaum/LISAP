import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Progress,
  Code,
  OrderedList,
  ListItem,
  Divider,
  Textarea,
  Badge,
} from "@chakra-ui/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[Onboarding] onAuthStateChanged:", user?.email ?? "null");
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // While Firebase resolves the session, show a spinner
  if (authLoading) {
    return (
      <Box maxW="680px" mx="auto" mt={20} textAlign="center">
        <Text color="gray.500">Loading...</Text>
      </Box>
    );
  }

  // If auth resolved to null, the user is not signed in — send them to login
  if (!currentUser) {
    console.log("[Onboarding] No user after auth resolved — redirecting to /login");
    navigate("/login");
    return null;
  }

  const siteUrl = window.location.origin;
  const ownerTag = currentUser?.uid;
  const joinUrl = `${siteUrl}/join/${ownerTag}`;

  function getInviteMessage() {
    return `Hey! I set up LISAP so you can get login codes for our shared account straight to your phone — no more waiting on me.\n\nJust sign up using this link: ${joinUrl}\n\nThat's it. Once you're in, you'll automatically get a push notification whenever a passcode comes through.`;
  }

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);

    const uid = currentUser?.uid;
    setAlias(`lisap.code+${uid}@gmail.com`);

    setLoading(false);
    setStep(2);
  }

  function openGmailFilters() {
    window.open("https://mail.google.com/mail/u/0/#settings/filters", "_blank");
  }

  function copyToClipboard(text, which) {
    navigator.clipboard.writeText(text);
    if (which === "alias") {
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    } else {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  }

  async function handleConfirmForwarding() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep(4);
  }

  return (
    <Box maxW="680px" mx="auto" mt={10} mb={16} p={8} bg="white" rounded="2xl" shadow="lg">
      <Heading size="lg" mb={6}>
        LISAP — Love Is Sharing A Password
      </Heading>

      {/* Step indicators */}
      <HStack spacing={3} mb={4}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <Box
            key={s}
            px={3}
            py={1}
            rounded="full"
            bg={step === s ? "blue.600" : step > s ? "green.400" : "gray.200"}
            color={step >= s ? "white" : "black"}
            fontSize="sm"
          >
            Step {s}
          </Box>
        ))}
      </HStack>

      <Progress value={(step / TOTAL_STEPS) * 100} mb={8} colorScheme="blue" />

      {/* ── STEP 1 — Account ── */}
      {step === 1 && (
        <form onSubmit={handleSignup}>
          <VStack spacing={5} align="stretch">
            <Text fontSize="md">
              Welcome! You're setting up LISAP as the <strong>account owner</strong> — the person
              who pays for Disney Plus or Netflix. Your friends will get their own accounts in the
              next step.
            </Text>
            <Text fontSize="md">
              First, confirm you're signed in with the Google account that receives your streaming
              service emails. You're currently signed in as:
            </Text>
            <Code p={3} rounded="md" fontSize="md">
              {currentUser?.email || "Not signed in"}
            </Code>
            <Text fontSize="sm" color="gray.500">
              If that's not right, sign out and log in with the correct account.
            </Text>
            <Button type="submit" colorScheme="blue" isLoading={loading}>
              That's my account — continue
            </Button>
          </VStack>
        </form>
      )}

      {/* ── STEP 2 — Gmail Filter Setup ── */}
      {step === 2 && (
        <VStack spacing={5} align="stretch">
          <Text fontSize="md">
            You'll set up a Gmail filter that automatically forwards passcode emails from Disney Plus
            or Netflix to your unique LISAP address. This takes about 2 minutes.
          </Text>

          <Box bg="blue.50" p={4} rounded="lg" borderLeft="4px solid" borderColor="blue.400">
            <Text fontWeight="semibold" mb={2}>Your unique forwarding address:</Text>
            <Code
              display="block"
              p={3}
              rounded="md"
              fontSize="sm"
              wordBreak="break-all"
              bg="white"
            >
              {alias}
            </Code>
            <Button
              mt={3}
              size="sm"
              colorScheme="blue"
              onClick={() => copyToClipboard(alias, "alias")}
            >
              {copiedAlias ? "Copied!" : "Copy address"}
            </Button>
          </Box>

          <Divider />

          <Text fontWeight="semibold" fontSize="md">How to create the filter in Gmail:</Text>

          <OrderedList spacing={4} pl={2}>
            <ListItem>
              <Text>
                Open Gmail and click the <strong>Settings gear</strong> (top right) → then{" "}
                <strong>See all settings</strong>.
              </Text>
            </ListItem>
            <ListItem>
              <Text>
                Go to the <strong>Filters and Blocked Addresses</strong> tab, then click{" "}
                <strong>Create a new filter</strong>.
              </Text>
            </ListItem>
            <ListItem>
              <VStack align="stretch" spacing={2}>
                <Text>
                  In the <strong>From</strong> field, enter the sender address(es) for your
                  streaming service:
                </Text>
                <HStack wrap="wrap" spacing={2}>
                  <Badge colorScheme="purple" fontSize="sm" px={2} py={1}>
                    disneyplus@mail.disneyplus.com
                  </Badge>
                  <Badge colorScheme="red" fontSize="sm" px={2} py={1}>
                    info@account.netflix.com
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  Only add the ones that apply to you. You can create a separate filter for each.
                </Text>
              </VStack>
            </ListItem>
            <ListItem>
              <Text>
                Click <strong>Create filter</strong> (bottom right of the dialog).
              </Text>
            </ListItem>
            <ListItem>
              <VStack align="stretch" spacing={1}>
                <Text>
                  On the next screen, check <strong>Forward it to</strong>, then paste your LISAP
                  address from above.
                </Text>
                <Text fontSize="sm" color="gray.500">
                  Gmail may send a confirmation email to that address — LISAP will handle it
                  automatically.
                </Text>
              </VStack>
            </ListItem>
            <ListItem>
              <Text>
                Click <strong>Create filter</strong> to save. You're done!
              </Text>
            </ListItem>
          </OrderedList>

          <Button
            variant="outline"
            onClick={openGmailFilters}
            alignSelf="flex-start"
          >
            Open Gmail Settings ↗
          </Button>

          <Divider />

          <Button colorScheme="green" onClick={() => setStep(3)}>
            I've set up the filter — continue
          </Button>
        </VStack>
      )}

      {/* ── STEP 3 — Confirm Forwarding ── */}
      {step === 3 && (
        <VStack spacing={5} align="stretch">
          <Text fontSize="md">
            To make sure everything is working, send yourself a test email or wait for your next
            passcode from Disney Plus or Netflix.
          </Text>
          <Box bg="gray.50" p={4} rounded="lg">
            <Text fontWeight="semibold" mb={1}>Quick test:</Text>
            <OrderedList spacing={2} pl={2}>
              <ListItem>Open Disney Plus or Netflix and try to log in from a new device or browser.</ListItem>
              <ListItem>They'll send a passcode email to your Gmail.</ListItem>
              <ListItem>Gmail forwards it to your LISAP address, and you'll get a push notification.</ListItem>
            </OrderedList>
          </Box>
          <Text fontSize="sm" color="gray.500">
            Once you've confirmed a passcode came through, click below. If you'd rather skip
            testing for now, you can also just continue.
          </Text>
          <Button colorScheme="blue" onClick={handleConfirmForwarding} isLoading={loading}>
            Looks good — continue
          </Button>
        </VStack>
      )}

      {/* ── STEP 4 — Invite Friends ── */}
      {step === 4 && (
        <VStack spacing={5} align="stretch">
          <Text fontSize="md">
            Now invite the people who share your account. Send them this message — they'll sign up
            for their own LISAP account and start receiving push notifications automatically.
          </Text>

          <Box bg="gray.50" p={4} rounded="lg" border="1px solid" borderColor="gray.200">
            <Textarea
              value={getInviteMessage()}
              isReadOnly
              rows={7}
              fontSize="sm"
              resize="none"
              bg="white"
            />
          </Box>

          <Button
            colorScheme="blue"
            alignSelf="flex-start"
            onClick={() => copyToClipboard(getInviteMessage(), "invite")}
          >
            {copiedInvite ? "Copied!" : "Copy message"}
          </Button>

          <Text fontSize="sm" color="gray.500">
            You can always reshare this from your dashboard. Your friends just need to sign up —
            no additional setup required on their end.
          </Text>

          <Divider />

          <Button colorScheme="green" onClick={() => setStep(5)}>
            Done — finish setup
          </Button>
        </VStack>
      )}

      {/* ── STEP 5 — Complete ── */}
      {step === 5 && (
        <VStack spacing={5} align="center" textAlign="center">
          <Text fontSize="4xl">🎉</Text>
          <Heading size="md">You're all set!</Heading>
          <Text color="gray.600" maxW="420px">
            Whenever a passcode email hits your inbox, LISAP will push it straight to your phone.
            No more copy-pasting codes.
          </Text>
          <Button
            colorScheme="green"
            size="lg"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
          >
            Go to Dashboard
          </Button>
        </VStack>
      )}
    </Box>
  );
}
