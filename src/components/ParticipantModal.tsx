import Image from "next/image";
import { Participant } from "@/types/participant";

interface ParticipantModalProps {
  participant: Participant;
  onClose: () => void;
}

export default function ParticipantModal({
  participant,
  onClose,
}: ParticipantModalProps) {
  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#83101a] p-6 md:p-8 rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-md z-[9999] max-h-[90vh] md:max-h-fit overflow-y-auto md:overflow-visible flex flex-col"
      style={{ fontFamily: "Murder, sans-serif" }}
    >
      <div className="flex justify-center mb-6">
        <Image
          src={participant.imageUrl}
          alt={participant.name}
          width={200}
          height={200}
          className={`rounded-full border-4 border-white shadow-lg w-48 h-48 sm:w-32 sm:h-32 ${
            participant.status === "dead" ? "blood-red" : ""
          }`}
          style={{ objectFit: "cover" }}
        />
      </div>
      <div
        className="text-white text-left mb-2 leading-relaxed break-words"
        style={{
          fontSize: "clamp(1.25rem, 5vw, 2.5rem)",
          fontFamily: "Murder, sans-serif",
        }}
      >
        Navn: {participant.name}
        <br />
        Studie: {participant.study}
        <br />
        Klassetrinn: {participant.class}
        <br />
        Hårfarge: {participant.hairColor || "Ikke oppgitt"}
        <br />
        Øyenfarge: {participant.eyeColor || "Ikke oppgitt"}
        <br />
        Høyde:{" "}
        {participant.height ? `${participant.height} cm` : "Ikke oppgitt"}
      </div>
      <div className="flex justify-end mt-4">
        <button
          className="bg-[#721c24] hover:bg-[#c7313b] active:bg-[#c7313b] text-white border-2 border-[#3e0309] px-5 py-2.5 rounded cursor-pointer text-center whitespace-nowrap transition-colors"
          onClick={onClose}
          style={{
            fontSize: "clamp(1.25rem, 4vw, 1.875rem)",
            fontFamily: "Murder, sans-serif",
          }}
        >
          Lukk
        </button>
      </div>
    </div>
  );
}
