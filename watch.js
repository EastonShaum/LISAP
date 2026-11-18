import { getGmail } from "./gmail.js";

const RENEW_BUFFER_MS = 60 * 60 * 1000; // renew 1 hour before expiration

export async function startWatch() {
  const gmail = await getGmail();

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: "projects/email-sms-service/topics/lisap",
      labelIds: ["INBOX"],
    },
  });

  console.log("📡 Gmail Watch Activated");
  console.log(res.data);

  // Schedule a renewal before Google's 7-day expiration
  const expiration = parseInt(res.data.expiration, 10);
  const renewIn = expiration - Date.now() - RENEW_BUFFER_MS;
  console.log(`🔄 Watch renewal scheduled in ${Math.round(renewIn / 3600000)}h`);
  setTimeout(() => startWatch().catch(console.error), renewIn);
}