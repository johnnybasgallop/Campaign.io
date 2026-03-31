import { UserButton } from "@clerk/react";
import { BsMoonFill, BsSunFill } from "react-icons/bs";
import { MdScheduleSend } from "react-icons/md";

type Props = {
  dark: boolean;
  onToggleDark: () => void;
};

export function Header({ dark, onToggleDark }: Props) {
  return (
    <header className="border-b border-purple-100 dark:border-purple-900/40 px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <MdScheduleSend className="text-purple-800 dark:text-purple-400 text-2xl" />
        <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
          DMOCampaigns
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDark}
          aria-label="Toggle dark mode"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          {dark ? <BsSunFill className="text-base" /> : <BsMoonFill className="text-base" />}
        </button>
        <UserButton />
      </div>
    </header>
  );
}
