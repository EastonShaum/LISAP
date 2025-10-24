import { gmailClient } from "../config/google.js";
import { updateUser } from "../db/users.js";

export const setupWatch = async (auth, email) => {
  const gmail = gmailClient(auth);
  const topic = `projects/${process.env.GCP_PROJECT_ID}/topics/${process.env.PUBSUB_TOPIC}`;
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName: topic, labelIds: ["INBOX"] },
  });
  await updateUser(email, { watchInfo: res.data });
  return res.data;
};

export const fetchLatestMessages = async (auth, startHistoryId) => {
  const gmail = gmailClient(auth);
  const history = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"],
  });
  const messages = [];
  for (const h of history.data.history || []) {
    for (const added of h.messagesAdded || []) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: added.message.id,
        format: "full",
      });
      messages.push(msg.data);
    }
  }
  return messages;
};
