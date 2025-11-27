export function getCurrentUser() {
  return {
    username: localStorage.getItem("userName")   || "",
    firstName: localStorage.getItem("firstName") || localStorage.getItem("userName") || "",
    role: localStorage.getItem("userRole")       || ""
  };
}