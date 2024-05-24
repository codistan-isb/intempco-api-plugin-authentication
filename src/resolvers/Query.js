export default {
  adminAccounts: async (_, { user }, ctx) => {
    // console.log("In get account admin");
    const { injector, infos, collections } = ctx;
    // const accountsServer = injector.get(server_1.AccountsServer);
    // const accountsPassword = injector.get(password_1.AccountsPassword);
    const { Accounts, users } = collections;

    let admins = await Accounts.find({
      userRole: "admin",
    }).toArray();

    return admins;
  },
};
