import Link from "next/link";
import LoginButton from "@/components/home/LoginButton";

export default function Welcome() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-gradient-brand">CSV Chat</span>
        </span>
        <LoginButton />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          <span className="text-gradient-brand">Chat with CSV Files</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Upload your spreadsheets and ask questions in plain English. Get answers, charts and the data behind them.
        </p>
        <Link
          href="/chat"
          className="bg-gradient-brand mt-10 rounded-full px-9 py-3.5 text-base font-semibold text-white shadow-lg shadow-pink-200 transition-transform hover:scale-[1.03]"
        >
          Chat with CSV
        </Link>
      </main>
    </div>
  );
}
