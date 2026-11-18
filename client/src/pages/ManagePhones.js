import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { Box, Button, Input, VStack, List, ListItem } from "@chakra-ui/react";

export default function ManagePhones() {
  const [phones, setPhones] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/users/me`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();
      setPhones(data.phones || []);
    };
    fetchUser();
  }, []);

  const save = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Login first");
    const idToken = await user.getIdToken();
    const newPhones = [...phones, input].filter(Boolean);
    await fetch(`${process.env.REACT_APP_API_URL || ""}/api/users/me`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phones: newPhones, active: true })
    });
    setPhones(newPhones);
    setInput("");
  };

  const removePhone = async (p) => {
    const newPhones = phones.filter(x => x !== p);
    const user = auth.currentUser;
    const idToken = await user.getIdToken();
    await fetch(`${process.env.REACT_APP_API_URL || ""}/api/users/me`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phones: newPhones })
    });
    setPhones(newPhones);
  };

  return (
    <Box p={4} maxW="md" mx="auto">
      <VStack spacing={4}>
        <Input placeholder="+15550001111" value={input} onChange={(e)=>setInput(e.target.value)} />
        <Button onClick={save} colorScheme="green">Add Phone</Button>
        <List w="full">
          {phones.map(p => (
            <ListItem key={p} display="flex" justifyContent="space-between" p={2} borderBottom="1px solid #eee">
              <span>{p}</span>
              <Button onClick={()=>removePhone(p)} size="sm" colorScheme="red">Remove</Button>
            </ListItem>
          ))}
        </List>
      </VStack>
    </Box>
  );
}