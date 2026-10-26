export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/overview/:path*", "/logs/:path*", "/settings/:path*", "/"],
};
