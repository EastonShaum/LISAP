import { Accordion, Span } from "@chakra-ui/react"


const items = [
  { value: "1", title: "How does this work?", text: "A trigger is setup in your email to only watch for the passcode email that come from disney" },
  { value: "2", title: "Second Item", text: "Some value 2..." },
  { value: "3", title: "Third Item", text: "Some value 3..." },
]

export default function FAQ() {
 return (
    <Accordion.Root collapsible defaultValue={["1"]}>
      {items.map((item, index) => (
        <Accordion.Item key={index} value={item.value}>
          <Accordion.ItemTrigger>
            <Span flex="1">{item.title}</Span>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>{item.text}</Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}