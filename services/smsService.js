import { twClient } from "../config/twilio.js";

export const sendSMS = async (to, text) => {
  return await twClient.messages.create({
    body: text,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });
};
