import { generatePhoneOtp } from "../util/otp.js";
import bcrypt from "bcrypt";
import _ from "lodash";
import password_1 from "@accounts/password";
import server_1 from "@accounts/server";
import ReactionError from "@reactioncommerce/reaction-error";
import { sendEmailOTP } from "../util/otp.js";
import { sendAdminCredentialsEmail } from "../util/sendAdminCredentialsEmail.js";
import { randomPasswordGenerator } from "../util/randomPasswordGenerator.js";
import { checkEmailOrUsername } from "../util/checkEmailOrUsername.js";

const genericOtpFunc = async (createdUser, ctx) => {
  let data;
  if (createdUser.type == "phoneNo" && createdUser?.username) {
    data = await generatePhoneOtp(ctx, createdUser.username, userId);
  }
  if (createdUser.type == "email" && createdUser.emails.length) {
    data = await sendEmailOTP(ctx, createdUser.emails[0].address, "temp");
  }

  return data;
};

export default {
  /**
   * @method createUser
   * @summary Create a user for signup without otp
   * @param {Object} context Startup context
   * @param {Object} CreateUserInput options
   * @returns {Object} CreateUserResult
   */

  createUser: async (_, { user }, ctx) => {
    const { injector, infos } = ctx;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    let userId;
    try {
      console.log("user", user);
      //add user in a document using createUser function
      userId = await accountsPassword.createUser(user);
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        (error.code === password_1.CreateUserErrors.EmailAlreadyExists ||
          error.code === password_1.CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }
    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }
    // When initializing AccountsServer we check that enableAutologin and ambiguousErrorMessages options
    // are not enabled at the same time
    const createdUser = await accountsServer.findUserById(userId);
    // If we are here - user must be created successfully
    // Explicitly saying this to Typescript compiler
    const loginResult = await accountsServer.loginWithUser(createdUser, infos);
    return {
      userId,
      loginResult,
    };
  },

  /**
   * @method addAdmin
   * @summary Add a admin from adminpanel and send its password on the basis of email and password
   * @param {Object} context Startup context
   * @param {Object} CreateUserInput options
   * @returns {Object} CreateUserResult
   */
  addAdmin: async (_, { user }, ctx) => {
    const { injector, infos, collections } = ctx;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;
    let userId;
    const options = { new: true };

    //to generate random password
    let randomPassword = await randomPasswordGenerator(10);

    user.userRole = "admin";
    user.password = randomPassword;
    user.username = "p" + Date.now();
    user.phoneVerified = false;

    try {
      //add user in a document using createUser function
      userId = await accountsPassword.createUser(user);
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        (error.code === password_1.CreateUserErrors.EmailAlreadyExists ||
          error.code === password_1.CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }
    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }

    //Also create a account for created user
    const adminCount = await Accounts.findOne({
      _id: userId,
    });
    if (userId) {
      const account = {
        _id: userId,
        acceptsMarketing: false,
        emails: [
          {
            address: user.email,
            verified: true,
            provides: "default",
          },
        ],
        groups: [],
        name: null,
        profile: {
          firstName: "here goes first name",
          lastName: user.lastName,
          phone: user.username ? user.username : "",
        },
        shopId: null,
        state: "new",
        userId: userId,
        isDeleted: false,
        type: user.type,
        userRole: user.userRole,
      };
      const accountAdded = await Accounts.insertOne(account);
      let updateUser = { $set: { "emails.0.verified": true } };
      const { result } = await users.updateOne(
        { _id: userId },
        updateUser,
        options
      );
    }

    const createdUser = await accountsServer.findUserById(userId);

    //send email to newly created Admin
    let data = await sendAdminCredentialsEmail(
      ctx,
      createdUser.emails[0].address,
      randomPassword,
      "temp"
    );

    return {
      userId,
      createdUser,
    };
  },

  /**
   * @method createUserWithOtp
   * @summary Create a user for signUp with otp
   * @param {Object} context Startup context
   * @param {Object} CreateUserInput options
   * @returns {Object} CreateUserResult
   */
  async createUserWithOtp(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;
    let userId;

    console.log("User is ", user);

    //check if either email or username provided
    if (!(user?.email || user.username)) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide either an email address or a username to proceed."
      );
    }

    try {
      //creating a user
      userId = await accountsPassword.createUser({
        email: user.email,
        password: user.password,
        username: user.username,
        userRole: "user",
        type: user.type,
        firstName: user?.firstName ? user?.firstName : "",
        lastName: user?.lastName ? user?.lastName : "",
        createdAt: new Date(),
        updatedAt: new Date(),
        dob: user.dob,
        picture: user.picture
      });
    } catch (error) {
      // If ambiguousErrorMessages is true we obfuscate the email or username already exist error
      // to prevent user enumeration during user creation
      if (
        accountsServer.options.ambiguousErrorMessages &&
        error instanceof server_1.AccountsJsError &&
        (error.code === password_1.CreateUserErrors.EmailAlreadyExists ||
          error.code === password_1.CreateUserErrors.UsernameAlreadyExists)
      ) {
        return {};
      }
      throw error;
    }
    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages ? null : userId,
      };
    }

    //Also create a account for created user
    const adminCount = await Accounts.findOne({
      _id: userId,
    });
    // console.log("adminCount", adminCount);
    if (userId) {
      const account = {
        _id: userId,
        acceptsMarketing: false,
        emails: [
          {
            address: user.email,
            verified: false,
            provides: "default",
          },
        ],
        groups: [],
        name: user?.firstName + " " + user?.lastName,
        username: user.username
          ? user.username
          : user?.firstName + " " + user?.lastName,
        profile: {
          firstName: user.firstName ? user.firstName : "",
          lastName: user.lastName ? user.lastName : "",
          phone: user.phone ? user.phone : user.telephone1,
          languageAccount: user.languageAccount ? user.languageAccount : "",
          industry: user.industry ? user.industry : "",
          company: user.company ? user.company : "",
          position: user.position ? user.position : "",
          addressAccount: user.addressAccount ? user.addressAccount : "",
          cityAccount: user.cityAccount ? user.cityAccount : "",
          stateAccount: user.stateAccount ? user.stateAccount : "",
          countryAccount: user.countryAccount ? user.countryAccount : "",
          zipcode: user.zipcode ? user.zipcode : "",
          telephone1: user.telephone1 ? user.telephone1 : "",
          telephone2: user.telephone2 ? user.telephone2 : "",
          dob: user.dob ? user.dob : "",
          picture: user.picture ? user.picture : ""
        },
        profileImage: user.profileImage ? user.profileImage : "null",
        shopId: null,
        state: "new",
        userId: userId,
        isDeleted: false,
        type: user.type,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRole: user.userRole,
      };
      const accountAdded = await Accounts.insertOne(account);
    }
    // When initializing AccountsServer we check that enableAutologin and ambiguousErrorMessages options
    // are not enabled at the same time
    const createdUser = await accountsServer.findUserById(userId);

    //function to check which service(email or sms) to send otp
    let genericOtpResponse = await genericOtpFunc(createdUser, ctx);

    return {
      userId,
      createdUser,
    };
  },

  /**
   * @method loginUser
   * @summary Method for user to Login
   * @param {Object} context Startup context
   * @param {Object} LoginUserInput
   * @returns {Object} Access and refresh token
   */
  async loginUser(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;
    let isVerified = false;
    let userData;
    let newObj;

    console.log("Input is ", user);

    //check if either email or username provided
    if (!(user?.email || user?.username)) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide either an email address or a phone number to proceed."
      );
    }

    //if user loginTpye is email then find user with that email
    if (user?.email) {
      userData = await users.findOne({ "emails.address": user.email });
    }

    //if user loginType is username then find user by username
    if (user?.username) {
      userData = await users.findOne({ username: user.username });
    }

    //if user not found
    if (!userData) {
      throw new ReactionError("not-found", "Account not found");
    }

    //checking if account is deleted or not
    const checkedAccount = await ctx.mutations.deleteAccountCheck(ctx, {
      userId: userData._id,
    });

    if (!accountsServer.options.enableAutologin) {
      return {
        userId: accountsServer.options.ambiguousErrorMessages
          ? null
          : userData._id,
      };
    }
    let userCheck = user.email ? user.email : user.username;
    console.log("userCheck", userCheck);
    //check if user verified or not
    let result = await checkEmailOrUsername(userCheck);

    console.log("Response is ", result);

    //if user is trying to login from email or username
    if (result) {
      isVerified = userData.emails[0].verified;
      newObj = {
        user: {
          email: user.email,
        },
        password: user.password,
      };
    } else {
      isVerified = userData.emails[0].verified;
      newObj = {
        user: {
          username: user.username,
        },
        password: user.password,
      };
    }

    if (!isVerified) {
      throw new ReactionError(
        "not-found",
        "User is not verified,Please verify yout account"
      );
    }

    console.log("newObj is ", newObj, userData);
    const createdUser = await accountsServer.findUserById(userData._id);
    createdUser.services.password.bcrypt = user.password;

    console.log("createdUser is ", createdUser);

    //authenticating password
    const authenticated = await injector
      .get(server_1.AccountsServer)
      .loginWithService("password", newObj, infos);

    console.log("authenticated is ", authenticated);

    return {
      loginResult: authenticated,
    };
  },

  /**
   * @method resetPasswordOtp
   * @summary Method for sending a otp to user if forget(reset) password
   * @param {Object} context Startup context
   * @param {Object} ResetpasswordInput
   * @returns {Object} resetPasswordResult
   */
  async resetPasswordOtp(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;
    const accountsServer = injector.get(server_1.AccountsServer);
    const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;
    let { loginTypeValue } = user;
    let userData;
    // console.log("user", user);
    if (!user.loginTypeValue) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide either an email address or a username to proceed."
      );
    }
    console.log("user", user);

    //check if user verified or not
    let result = await checkEmailOrUsername(loginTypeValue);

    // console.log("Response is ", result);

    if (result) {
      userData = await users.findOne({ "emails.address": user.loginTypeValue });
    } else {
      userData = await users.findOne({ username: user.loginTypeValue });
    }

    if (!userData) {
      throw new ReactionError("not-found", "Account not found");
    }

    //checking if account is deleted or not
    const checkedAccount = await ctx.mutations.deleteAccountCheck(ctx, {
      userId: userData._id,
    });

    let data = await genericOtpFunc(userData, ctx);

    if (data) {
      return {
        userId: userData._id,
        success: true,
      };
    }
    return {
      userId: userData._id,
      success: false,
    };
  },

  /**
   * @method verifyOTP
   * @summary Verify otp is user for both user signup and reset password
   * @param {Object} context Startup context
   * @param {Object} VerifyUserOtpInput options
   * @returns {Boolean} CreateUserResult
   */
  async verifyOTP(_, { user }, ctx) {
    // const { serviceName, params } = args;
    const { injector, infos, collections } = ctx;
    const { users, Accounts } = collections;

    //checking if account is deleted or not
    const checkedAccount = await ctx.mutations.deleteAccountCheck(ctx, {
      userId: user.userId,
    });

    //check if userId provided or not
    if (!user.userId) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide userId to proceed."
      );
    }

    //finding the user on the basis of userId
    const userObj = await users.findOne({ _id: user.userId });
    console.log("User Id is ", userObj);

    if (userObj) {
      //check if the otp in user document is same as user provided
      if (userObj.otp === user.otp) {
        // Check if the OTP is still valid otp expires after 15 minutes
        const expirationTime = new Date().getTime() + 15 * 60 * 1000;
        const isOtpValid = expirationTime > new Date().getTime();

        // to check if otp is valid or expired
        if (isOtpValid) {
          let updateOtp;
          const options = { new: true };

          //updating the user on the basis loginType email of phone
          if (userObj.type === "phoneNo") {
            updateOtp = { $set: { phoneVerified: true } };
          } else if (userObj.type === "email" || userObj.type === "username") {
            updateOtp = { $set: { "emails.0.verified": true } };
          } else {
            console.log("error in loginType");
          }

          //updating the user to verified user
          const { result } = await users.updateOne(
            { _id: userObj._id },
            updateOtp,
            options
          );

          //updating the account of user after verification
          const { result: accountResult } = await Accounts.updateOne(
            { _id: userObj._id },
            updateOtp,
            options
          );

          return result.n;
        } else {
          //OTP has expired
          return false;
        }
      } else {
        //Otp is incorrect
        throw new ReactionError("not-found", "Otp is incorrect");
      }
    } else {
      //User not found
      throw new ReactionError("not-found", "User not found");
    }
  },

  /**
   * @method resetPasswordAfterOtpVerify
   * @summary Method for reset the password after user recived the otp by doing reset password and verifyOtp
   * @param {Object} context Startup context
   * @param {Object} esetPasswordAfterOtpVerifyInput
   * @returns {Boolean}
   */
  async resetPasswordAfterOtpVerify(_, { user }, ctx) {
    const { injector, infos, collections } = ctx;
    const { users } = collections;

    //generates a random salt which is used to hashed the password
    const salt = bcrypt.genSaltSync();

    //checking if userId provided
    if (!user.userId) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide userId to proceed."
      );
    }

    //checking if new password provided
    if (!user.password) {
      throw new ReactionError(
        "invalid-parameter",
        "Please provide new password"
      );
    }

    //checking if account is deleted or not
    const checkedAccount = await ctx.mutations.deleteAccountCheck(ctx, {
      userId: user.userId,
    });

    //Finding the user on the basis of userId
    const userObj = await users.findOne({ _id: user.userId });
    console.log("User Id is ", userObj);

    //If user found then check otp and expiration again
    if (userObj) {
      if (userObj.otp === user.otp) {
        const expirationTime = new Date().getTime() + 15 * 60 * 1000;

        // Check if the OTP is still valid
        const isOtpValid = expirationTime > new Date().getTime();
        console.log("isOtpValid ", isOtpValid);
        // Use the value of isOtpValid to perform further actions, for example:
        if (isOtpValid) {
          let updateOtp;
          const options = { new: true };

          console.log(
            "createdUser.services.password.bcrypt ",
            userObj.services.password.bcrypt
          );

          const hashedPassword = bcrypt.hashSync(user.password, salt);

          if (userObj.type === "email" || userObj.type === "username") {
            updateOtp = {
              $set: {
                "services.password.bcrypt": hashedPassword,
                "emails.0.verified": true,
              },
            };
          } else {
            throw new ReactionError(
              "not-found",
              "User login type not recognized"
            );
          }

          console.log("Original Password:", user.password);
          console.log("Hashed Password:", hashedPassword);

          const { result } = await users.updateOne(
            { _id: userObj._id },
            updateOtp,
            options
          );
          return result.n > 0 ? true : false;
        } else {
          console.log("OTP has expired");
          return false;
          // Perform further actions for expired OTP
        }
      } else {
        throw new ReactionError("not-found", "Otp is incorrect");
      }
    } else {
      throw new ReactionError("not-found", "Could not found user");
    }
  },

  /**
   * @method changePassword
   * @summary Method for user to change password,when he is loggedIn
   * @param {Object} context Startup context
   * @param {Object} old and new password
   * @returns {Boolean}
   */
  changePassword: async (_, input, context) => {
    let { oldPassword, newPassword } = input;
    let { user, injector } = context;

    //check if user and userId provided
    if (!(user && user.id)) {
      throw new Error("Unauthorized");
    }

    const userId = user.id;
    console.log("before delete account check");
    //checking if account is deleted or not
    const checkedAccount = await context.mutations.deleteAccountCheck(context, {
      userId: user.userId,
    });

    //function to check the old password and update the password
    let responsePassword = await injector
      .get(password_1.AccountsPassword)
      .changePassword(userId, oldPassword, newPassword);
    console.log("change password response ", responsePassword);
    return true;
  },

  authenticate: async (_, args, ctx) => {
    console.log("args", args);
    const { serviceName, params } = args;
    const { injector, infos, collections } = ctx;
    const { users } = collections;
    console.log("authenticate");
    const authenticated = await injector
      .get(server_1.AccountsServer)
      .loginWithService(serviceName, params, infos);
    console.log("authenticated", authenticated);
    return authenticated;
  },

  async resetUserName(parent, args, context, info) {
    // console.log("args", args);
    const { injector, infos, collections } = context;
    const { Accounts, users, Shops } = collections;

    let { Email } = args;
    let userData = await users.findOne({ "emails.address": Email });
    // console.log("userData", userData);
    if (!userData) {
      throw new ReactionError("not-found", "Account not found");
    }
    //Finding the account of user
    const account = await Accounts.findOne({ _id: userData._id });
    if (!account) throw new ReactionError("not-found", "Account not found");
    const shop = await Shops.findOne({ shopType: "primary" });
    if (!shop) throw new ReactionError("not-found", "Shop not found");
    // console.log("shop data ",shop);
    let language =
      (account.profile && account.profile.language) || shop.language;
    let dataForEmail = {
      // Reaction Information
      contactEmail: "info@intempco.com",
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
      confirmationUrl: userData?.username,
      userEmailAddress: Email,
    };
    let emailSend = await context.mutations.sendEmail(context, {
      data: dataForEmail,
      fromShop: shop,
      templateName: "accounts/resetUsername",
      language,
      to: Email,
    });
    // console.log("emailSend",emailSend);
    return {
      status: true,
      mesasge: "Email sent Sucessfully",
    };
  },
};
