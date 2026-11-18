import { Flex, Heading, Link } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

export default function Navbar() {
  return (
    <Flex
      as="nav"
      justify="space-between"
      align="center"
      p={4}
      bg="blue.500"
      color="white"
    >
      <Heading size="md">My App</Heading>
    </Flex>
  );
}