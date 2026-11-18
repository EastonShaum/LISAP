import Twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

export const twClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);