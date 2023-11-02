import _ from "lodash";
import ReactionError from "@reactioncommerce/reaction-error";
import generateOTPForResetPassword from "./generateOTPForResetPassword.js";

// const { REACTION_IDENTITY_PUBLIC_VERIFY_EMAIL_URL } = config;

/**
 * @method sendOTPEmail
 * @summary Send an email with a otp for signup and reset Password.
 * @param {Object} context Startup context
 * @param {Object} input Input options
 * @param {String} input.userId - The id of the user to send email to.
 * @param {String} [input.bodyTemplate] Template name for rendering the email body
 * @returns {Job} - returns a sendEmail Job instance
 */

export default async function sendResetPasswordOTP(
  context,
  email,
  { bodyTemplate = "accounts/newEmail", userId }
) {
  //function to get otp and expiration time
  const { otp, expirationTime } = await generateOTPForResetPassword();

  const {
    collections: { Accounts, Shops, users },
  } = context;

  //updating the user with expiration date and otp
  const updateAccountResult = await users.updateOne(
    { "emails.address": email },

    { $set: { otp: otp, expirationTime: expirationTime } } // $set updates the fields with the new values
  );

  const UserData = await users.findOne({ "emails.address": email });
  if (!UserData) {
    // The user document does not exist, throw an error or handle it as needed
    throw new ReactionError("not-found", "Account not found");
  }

  const account = await Accounts.findOne({ _id: UserData._id });
  if (!account) throw new ReactionError("not-found", "Account not found");

  // Account emails are always sent from the primary shop email and using primary shop
  // email templates.
  const shop = await Shops.findOne({ shopType: "primary" });
  if (!shop) throw new ReactionError("not-found", "Shop not found");

  const dataForEmail = {
    // Reaction Information
    contactEmail: _.get(shop, "emails[0].address"),
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
    userEmailAddress: email,
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
