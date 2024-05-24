import _ from "lodash";
import ReactionError from "@reactioncommerce/reaction-error";
import config from "../config.js";
import generateOTPForResetPassword from "./generateOTPForResetPassword.js";
import Twilio from "twilio";

// const { REACTION_IDENTITY_PUBLIC_VERIFY_EMAIL_URL } = config;

var dict = {};

var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);

/**
 * @method sendEmailOTP
 * @summary Send an email with a otp the user can use verify their email address.
 * @param {Object} context Startup context
 * @param {Object} input Input options
 * @param {String} input.userId - The id of the user to send email to.
 * @param {String} [input.bodyTemplate] Template name for rendering the email body
 * @returns {Job} - returns a sendEmail Job instance
 */

export async function sendEmailOTP(
  context,
  email,
  { bodyTemplate = "accounts/otpEmail", temp }
) {
  const {
    collections: { Accounts, Shops, users },
  } = context;

  //get otp and expiration date
  const { otp, expirationTime } = await generateOTPForResetPassword();

  //object for user update otp and expiration date
  const options = { new: true };
  const updateOtp = { $set: { otp: otp, expirationTime: expirationTime } };

  const UserData = await users.findOne({ "emails.address": email });
  if (!UserData) {
    // The user document does not exist, throw an error or handle it as needed
    throw new ReactionError("not-found", "Account not found");
  }

  //Finding the account of user
  const account = await Accounts.findOne({ _id: UserData._id });
  if (!account) throw new ReactionError("not-found", "Account not found");

  //updating the user
  const updateUserResult = await users.updateOne(
    { "emails.address": email },
    updateOtp,
    options
  );

  // Account emails are always sent from the primary shop email and using primary shop
  // email templates.
  const shop = await Shops.findOne({ shopType: "primary" });
  if (!shop) throw new ReactionError("not-found", "Shop not found");

  const dataForEmail = {
    // Reaction Information
    contactEmail: "test@gmail.com",
    homepage: _.get(shop, "storefrontUrls.storefrontHomeUrl", null),
    copyrightDate: new Date().getFullYear(),
    legalName: _.get(shop, "addressBook[0].company"),
    physicalAddress: {
      address: `${_.get(shop, "addressBook[0].address1")} ${_.get(
        shop,
        "addressBook[0].address2"
      )}`,
      city: _.get(shop, "addressBook[0].city"),
      region: _.get(shop, "addressBook[0].region"),
      postal: _.get(shop, "addressBook[0].postal"),
    },
    shopName: shop.name,
    // confirmationUrl: REACTION_IDENTITY_PUBLIC_VERIFY_EMAIL_URL.replace("TOKEN", token),
    confirmationUrl: otp,
    userEmailAddress: "test@gmail.com",
  };
  const language =
    (account.profile && account.profile.language) || shop.language;

  return context.mutations.sendEmail(context, {
    data: dataForEmail,
    fromShop: shop,
    templateName: bodyTemplate,
    language,
    to: email,
  });
}

/**
 * @method generatePhoneOtp
 * @summary Send an otp on the user can use verify their phone number.
 * @param {Object} context Startup context
 * @param {Object} input Input options
 * @param {String} input.userId - The id of the user to send message to.
 * @returns {Job} - returns a user phone job
 */
//in progress twilio integration
export async function generatePhoneOtp(context, number, userId) {
  const {
    collections: { Accounts, Shops, users },
  } = context;

  const { otp, expirationTime } = await generateOTPForResetPassword();

  //   const { users } = context.collections;
  const options = { new: true };
  const updateOtp = { $set: { otp: otp, expirationTime: expirationTime } };

  const UserData = await users.findOne({ username: number });
  if (!UserData) {
    // The user document does not exist, throw an error or handle it as needed
    throw new ReactionError("not-found", "Account not found");
  }
  // console.log("User Response :- ", UserData._id);
  const account = await Accounts.findOne({ _id: UserData._id });
  // console.log("Account Resonse :-", account);
  if (!account) throw new ReactionError("not-found", "Account not found");

  const updateAccountResult = await users.updateOne(
    { username: number },
    updateOtp,
    options
  );

  console.log("otp and expiry updated: ", updateAccountResult);

  return otp;
}
