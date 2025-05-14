export const runtime = "edge";
import type { Metadata } from "next";

import Head from "next/head";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-mono p-8 sm:p-20 uppercase">
      <Head>
        <title>404: Page Not Found</title>
      </Head>
      <h1 className="text-4xl font-bold text-center">
        Oops, this page cannot be found.
      </h1>
      <Link href="/" className="btn-fill mt-4 font-semibold">
          <span className="mr-2">→</span>
          AFROTC Home
      </Link>
    </div>
  );
}

export const metadata: Metadata = {
  title: "404: Page Not Found",
  description: "Oops, this page cannot be found",
};