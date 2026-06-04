import React from "react";

export default function HeroSearch() {
  return (
    <form className="grid grid-cols-[auto_1fr_auto] items-center bg-white border border-[#c7c4d7] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] gap-3 mt-[34px] mx-auto max-w-[672px] p-[9px]" role="search">
      <span className="text-[#767586] text-xl pl-4" aria-hidden="true">
        ⌕
      </span>
      <input className="border-0 text-[#172033] min-h-[46px] outline-none px-[6px] placeholder:text-gray-500 w-full" aria-label="Search study documents" placeholder="Search for your course, book or school..." />
      <button className="bg-[#4648d4] border-0 rounded-xl text-white cursor-pointer text-sm font-extrabold min-h-[44px] px-8" type="submit">Search</button>
    </form>
  );
}
