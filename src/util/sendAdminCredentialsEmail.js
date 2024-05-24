import _ from "lodash";
import ReactionError from "@reactioncommerce/reaction-error";
import config from "../config.js";

/**
 * @method sendAdminCredentialsEmail
 * @summary Send an email with email and password for newly created admin.
 * @param {Object} context Startup context
 * @param {Object} input Input options
 * @param {String} input.userId - The id of the user to send email to.
 * @param {String} [input.bodyTemplate] Template name for rendering the email body
 * @returns {Job} - returns a sendEmail Job instance
 */

export async function sendAdminCredentialsEmail(
  context,
  emailAdmin,
  passwordAdmin,
  { bodyTemplate = "accounts/adminCredentialsEmail", temp }
) {
  const {
    collections: { Accounts, Shops, users },
  } = context;

  console.log("email is ", emailAdmin, passwordAdmin);

  const UserData = await users.findOne({ "emails.address": emailAdmin });
  if (!UserData) {
    // The user document does not exist, throw an error or handle it as needed
    throw new ReactionError("not-found", "Account not found");
  }
  // console.log("User Response :- ", UserData._id);
  const account = await Accounts.findOne({ _id: UserData._id });
  // console.log("Account Resonse :-", account);
  if (!account) throw new ReactionError("not-found", "Account not found");

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
    email: emailAdmin,
    password: passwordAdmin,
    userEmailAddress: "test@gmail.com",
  };
  const language =
    (account.profile && account.profile.language) || shop.language;

  return context.mutations.sendEmail(context, {
    data: dataForEmail,
    fromShop: shop,
    templateName: bodyTemplate,
    language,
    to: emailAdmin,
  });
}
