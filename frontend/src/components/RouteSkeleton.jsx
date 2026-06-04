import React from "react";

function PulseBlock({ className }) {
  return <div className={`animate-pulse rounded-md bg-[#dfe6f3] ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <main className="grid min-h-[calc(100vh-64px)] grid-cols-[224px_minmax(0,1fr)] bg-[#f7f9fb] text-[#191c1e]">
      <aside className="sticky top-16 flex h-[calc(100vh-64px)] flex-col border-r border-[#c7c4d7] bg-[#f2f4f6] px-3 py-4">
        <PulseBlock className="h-9 w-full bg-[#4648d4]/30" />
        <div className="mt-5 grid gap-2">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="flex h-11 items-center gap-3 rounded-md px-3" key={item}>
              <PulseBlock className="h-[18px] w-[18px]" />
              <PulseBlock className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="mt-auto grid gap-3 border-t border-[#c7c4d7] pt-3">
          <div className="flex items-center gap-2 px-1">
            <PulseBlock className="h-7 w-7 rounded-full" />
            <PulseBlock className="h-3 w-28" />
          </div>
          <PulseBlock className="h-10 w-full" />
        </div>
      </aside>

      <section className="grid min-w-0 w-full max-w-[1220px] gap-7 p-8">
        <section className="flex items-center justify-between rounded-xl border border-[#c7c4d7] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="grid gap-3">
            <PulseBlock className="h-7 w-72" />
            <PulseBlock className="h-4 w-96" />
          </div>
          <div className="flex gap-3">
            <PulseBlock className="h-10 w-36" />
            <PulseBlock className="h-10 w-44 bg-[#4648d4]/30" />
          </div>
        </section>

        <section className="grid grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((item) => (
            <article className="grid min-h-[118px] content-center gap-4 rounded-xl border border-[#c7c4d7] bg-white p-5" key={item}>
              <PulseBlock className="h-5 w-5" />
              <PulseBlock className="h-3 w-28" />
              <PulseBlock className="h-6 w-16" />
            </article>
          ))}
        </section>

        <section className="grid grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)] gap-7">
          <article className="overflow-hidden rounded-xl border border-[#c7c4d7] bg-white">
            <header className="flex items-center justify-between border-b border-[#c7c4d7] bg-[#f7f9fb] px-5 py-[18px]">
              <PulseBlock className="h-6 w-44" />
              <PulseBlock className="h-4 w-16" />
            </header>
            <div className="grid gap-0">
              {[0, 1, 2, 3].map((item) => (
                <div className="grid grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] gap-3 border-t border-[#d9dde6] px-4 py-[14px]" key={item}>
                  <PulseBlock className="h-4 w-40" />
                  <PulseBlock className="h-4 w-24" />
                  <PulseBlock className="h-4 w-20" />
                  <PulseBlock className="h-4 w-12" />
                  <PulseBlock className="h-4 w-12" />
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="grid gap-4 rounded-xl border border-[#c7c4d7] bg-white p-5">
              <PulseBlock className="h-6 w-40" />
              <PulseBlock className="h-10 w-full" />
              <PulseBlock className="h-10 w-full" />
            </article>
            <article className="grid gap-4 rounded-xl border border-[#c7c4d7] bg-white p-5">
              <PulseBlock className="h-6 w-32" />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((item) => <PulseBlock className="h-9 w-28" key={item} />)}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

function PanelSkeleton({ titleWidth = "w-56" }) {
  return (
    <main className="mx-auto my-8 grid max-w-[1120px] gap-5 px-6">
      <section className="rounded-lg border border-[#e5e9ef] bg-white p-8">
        <div className="grid gap-4">
          <PulseBlock className={`h-7 ${titleWidth}`} />
          <PulseBlock className="h-4 w-96" />
          <PulseBlock className="h-12 w-full" />
          <PulseBlock className="h-12 w-full" />
          <PulseBlock className="h-12 w-4/5" />
        </div>
      </section>
    </main>
  );
}

export default function RouteSkeleton({ variant = "page" }) {
  if (variant === "dashboard") return <DashboardSkeleton />;
  if (variant === "admin") return <PanelSkeleton titleWidth="w-48" />;
  if (variant === "library") return <PanelSkeleton titleWidth="w-60" />;
  return <PanelSkeleton />;
}
