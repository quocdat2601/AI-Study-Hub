import React from "react";

export default function DocumentCard({ document, featured = false }) {
  if (featured) {
    return (
      <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden col-span-2 row-span-2">
        <div className="bg-[#eceef0] relative h-64">
          <img className="w-full h-full object-cover" src={document.image} alt="" />
          <span className="absolute top-4 left-4 bg-[#4648d4] text-white text-xs font-bold rounded-full px-3 py-[5px]">{document.badge}</span>
        </div>
        <div className="p-6">
          <p className="text-[#4648d4] text-sm font-extrabold m-0 mb-3">{document.course}</p>
          <h3 className="text-xl leading-[1.4] m-0 mb-3">{document.title}</h3>
          <p className="text-[#464554] text-sm leading-[1.45] m-0 mb-6">{document.description}</p>
          <footer className="flex items-center justify-between border-t border-[#c7c4d7] pt-[17px] text-xs text-[#767586]">
            <div className="flex items-center gap-2 text-[#172033]">
              <span className="inline-flex items-center justify-center bg-[#d5e3fc] rounded-full text-[#4648d4] font-extrabold h-8 w-8">{document.initials}</span>
              <strong>{document.author}</strong>
            </div>
            <span>{document.rating}</span>
          </footer>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-[#eceef0] relative h-40">
        <img className="w-full h-full object-cover" src={document.image} alt="" />
        {document.pages ? <span className="absolute bottom-2 right-2 backdrop-blur-sm bg-white/90 rounded text-[#172033] text-xs font-bold px-2 py-1">{document.pages}</span> : null}
      </div>
      <div className="p-4">
        <p className="text-[#464554] text-xs font-extrabold tracking-[0.6px] uppercase m-0 mb-[6px]">{document.course}</p>
        <h3 className="text-sm leading-[1.42] m-0 mb-2">{document.title}</h3>
        <span className="text-[#767586] block text-xs font-bold">{document.school}</span>
      </div>
    </article>
  );
}
