export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/overview/:path*",
    "/alerts/:path*",
    "/accounts/:path*",
    "/logs/:path*",
    "/settings/:path*",
    "/",
  ],
};
