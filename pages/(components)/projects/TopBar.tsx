"use client";

import { PiFolderPlusDuotone } from "react-icons/pi";
import { RiSearchLine, RiArrowUpDownFill, RiDownloadLine, RiAddLine } from "react-icons/ri";
import { instrumentSerif } from "@/helpers/fonts";
import CreateProjectModal from "./CreateProjectModal";
import { useState } from "react";
import CreateEventModal from "./CreateEventModal";


const TopBar = ({ mainText, subText, type }: { mainText: string, subText: string, type: "event" | "project" }) => {

  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)

  const handleClick = () => {
    type == "project" ? setShowCreateProjectModal(true) : setShowCreateEventModal(true)
  }
  return (
    <div>
      {showCreateProjectModal && <CreateProjectModal onClose={() => setShowCreateProjectModal(false)}/>}
      {showCreateEventModal && <CreateEventModal onClose={() => setShowCreateEventModal(false)}/>}
      <div className="w-full flex justify-between pl-6 border border-black/10">
        <h1 className={`text-4xl ${instrumentSerif.className}`}>{mainText}</h1>
        <div className="flex items-center justify-between gap-4">
          <button className="p-2 rounded-md hover:bg-gray-100">
            <PiFolderPlusDuotone size={20} />
          </button>

          <div className="relative flex-1 max-w-xs">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-3 py-2 rounded-md bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <RiArrowUpDownFill />
            <span>Last modified</span>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--surface)] text-sm hover:bg-gray-50">
            <RiDownloadLine />
            Import
          </button>

          <button className="flex capitalize items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-blue-700" onClick={handleClick}>
            <RiAddLine />
            New {type}
          </button>
        </div>
      </div>

      <div className={`${instrumentSerif.className} text-3xl py-5 pl-6`}>
        {subText}
      </div>

    </div>
  )
}

export default TopBar
