export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-[family-name:var(--font-geist-mono)] p-8 sm:p-20">
      <h1 className="text-4xl font-bold text-center">
        This is NOT{" "}
        <a
          className="text-blue-500 underline"
          href="https://www.afrotc.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          afrotc.com
        </a>
      </h1>
      <p className="mt-4 text-center text-xl">Hello det 225 :)</p>
    </div>
  );
}