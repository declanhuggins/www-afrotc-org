import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-mono p-8 sm:p-20">
      <h1 className="text-4xl font-bold text-center">
        This is NOT <Link
          href="https://www.afrotc.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-fill"
        >
          <span className="mr-2">→</span>
          afrotc.com
        </Link>
      </h1>
      <p className="mt-4 text-center text-xl">
        Hello det 225 :)
      </p>
      <Link
        href="/marching"
        className="mt-8 inline-block px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold text-lg shadow hover:bg-blue-700 transition"
      >
        Try out my Marching Simulator here →
      </Link>
    </div>
  );
}