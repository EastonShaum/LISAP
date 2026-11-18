import admin from "firebase-admin";

export const sendPushNotification = async (fcmTokens, title, body) => {
  if (!fcmTokens || fcmTokens.length === 0) return;

  const message = {
    notification: { title, body },
    tokens: fcmTokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  if (response.failureCount > 0) {
    response.responses.forEach((resp, i) => {
      if (!resp.success) {
        console.error(`FCM failed for token ${fcmTokens[i]}:`, resp.error?.message);
      }
    });
  }

  return response;
};
