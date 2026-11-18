import React, { useState } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  Input,
  useToast,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

export default function PasswordPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const handleSubmit = () => {
    setLoading(true);

    const correctPassword =
      process.env.REACT_APP_DEV_PASSWORD;

    if (input === correctPassword) {
      toast({
        title: "Access granted",
        status: "success",
        duration: 1500,
      });

      // Redirect to your login or onboarding page
      setTimeout(() => {
        localStorage.setItem("dev_access", "true");
        navigate("/login");
      }, 800);
    } else {
      toast({
        title: "Incorrect password",
        status: "error",
        duration: 2000,
      });
      setLoading(false);
    }
  };

  return (
    <Box
      maxW="700px"
      mx="auto"
      mt={10}
      p={8}
      bg="white"
      rounded="2xl"
      shadow="lg"
    >
      <VStack spacing={5} align="stretch">
        <Heading size="lg">
          Hello! This site is still being worked on.
        </Heading>

        <Text>
          If you are an admin, please enter the password below:
        </Text>

        <Input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter password"
        />

        <Button
          colorScheme="blue"
          onClick={handleSubmit}
          isLoading={loading}
        >
          Enter
        </Button>
      </VStack>
    </Box>
  );
}