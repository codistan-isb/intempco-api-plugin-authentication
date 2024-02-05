export async function checkEmailOrUsername(user) {
  console.log("in checkEmail ", user);
  // let { loginTypeValue } = user;
  // Regular expression patterns to match email and username
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(user)) {
    console.log("Valid email");
    return true;
  } else {
    console.log("Invalid email");
    return false;
  }
}
