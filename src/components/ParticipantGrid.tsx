import Image from "next/image";
import { Participant } from "@/types/participant";

interface ParticipantGridProps {
  participants: Participant[];
  onParticipantClick: (participant: Participant) => void;
}

export default function ParticipantGrid({
  participants,
  onParticipantClick,
}: ParticipantGridProps) {
  return (
    <div className="grid-container">
      {participants.map((participant) => (
        <div key={participant.player} className="grid-item">
          <Image
            src={participant.imageUrl}
            alt={participant.name}
            width={150}
            height={150}
            className={participant.status === "dead" ? "blood-red" : ""}
            onClick={() => onParticipantClick(participant)}
            style={{ cursor: "pointer" }}
          />
        </div>
      ))}
    </div>
  );
}
