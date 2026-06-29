import React from "react";

export default function CommunityPageShell({
  children,
}) {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f5f4f0] text-[#191c1e] [scrollbar-gutter:stable]">
      <section className="px-4 py-5 md:px-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1120px] gap-5">
          {children}
        </div>
      </section>
    </main>
  );
}
