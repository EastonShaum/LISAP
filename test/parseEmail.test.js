import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCode,
  getBodyText,
  getPlusTag,
  getServiceName,
  parseForwardingConfirmation,
} from "../worker/src/parseEmail.js";

const b64 = (s) => Buffer.from(s).toString("base64url");
const h = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value }));

test("finds a 6-digit Disney+ passcode after the word passcode", () => {
  const body = "Your one-time passcode\n\n482913\n\nThis passcode will expire in 15 minutes.";
  assert.equal(extractCode("Your one-time passcode for Disney+", body), "482913");
});

test("finds a 4-digit Netflix sign-in code", () => {
  const body = "Enter this code to sign in\n7351\nThis code will expire in 15 minutes.";
  assert.equal(extractCode("Netflix: Your sign-in code", body), "7351");
});

test("joins a code written with a space", () => {
  assert.equal(extractCode("", "Your verification code is 482 913."), "482913");
});

test("ignores a year standing alone and returns null with no code", () => {
  assert.equal(extractCode("Your receipt", "Thanks for watching\n2026\nSee you soon"), null);
});

test("does not grab a long number like an order id", () => {
  assert.equal(extractCode("Order 1234567890123", "Your order 1234567890123 shipped"), null);
});

test("reads the plus tag from Delivered-To", () => {
  assert.equal(getPlusTag(h({ "Delivered-To": "lisap.code+abc123XYZ@gmail.com" })), "abc123XYZ");
  assert.equal(getPlusTag(h({ To: "Someone <lisap.code+u1@gmail.com>" })), "u1");
  assert.equal(getPlusTag(h({ "Delivered-To": "lisap.code@gmail.com" })), null);
});

test("names the streaming service from the sender", () => {
  assert.equal(getServiceName(h({ From: "Disney+ <disneyplus@mail.disneyplus.com>" })), "Disney+");
  assert.equal(getServiceName(h({ From: "Netflix <info@account.netflix.com>" })), "Netflix");
  assert.equal(getServiceName(h({ From: "\"Acme TV\" <hi@acme.tv>" })), "Acme TV");
});

test("prefers text/plain and falls back to stripped HTML", () => {
  const plain = { mimeType: "multipart/alternative", parts: [
    { mimeType: "text/plain", body: { data: b64("code 1234") } },
    { mimeType: "text/html", body: { data: b64("<b>ignored</b>") } },
  ] };
  assert.equal(getBodyText(plain), "code 1234");
  const html = { mimeType: "text/html", body: { data: b64("<p>Your code</p><p><b>5566</b></p>") } };
  assert.match(getBodyText(html), /Your code\s*\n\s*5566/);
});

test("parses Gmail's forwarding confirmation email", () => {
  const headers = h({
    From: "Gmail Team <forwarding-noreply@google.com>",
    Subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from owner@gmail.com",
  });
  const body =
    "owner@gmail.com has requested to automatically forward mail to your email address\n" +
    "Confirmation code: 123456789\n" +
    "To allow owner@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:\n" +
    "https://mail-settings.google.com/mail/vf-%5BANGjdJ-abc%5D-xyz\n";
  assert.deepEqual(parseForwardingConfirmation(headers, body), {
    code: "123456789",
    link: "https://mail-settings.google.com/mail/vf-%5BANGjdJ-abc%5D-xyz",
    requestedBy: "owner@gmail.com",
  });
});

test("ordinary mail is not a forwarding confirmation", () => {
  const headers = h({ From: "Disney+ <disneyplus@mail.disneyplus.com>", Subject: "Your passcode" });
  assert.equal(parseForwardingConfirmation(headers, "482913"), null);
});
