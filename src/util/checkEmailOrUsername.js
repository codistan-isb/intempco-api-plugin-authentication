export async function checkEmailOrUsername(user) {
  console.log("in checkEmail ", user);
  let input = user.email ? user.email : user.username;
  // Regular expression patterns to match email and username
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (emailPattern.test(input)) {
    console.log("email");
    return true;
  } else {
    console.log("username");
    return false;
  }
}
