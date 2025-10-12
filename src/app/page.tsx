"use client";

import { useState } from "react";
import { Participant } from "@/types/participant";
import { REFRESH_INTERVAL } from "@/lib/constants";
import ParticipantGrid from "@/components/ParticipantGrid";
import ParticipantModal from "@/components/ParticipantModal";
import { useParticipants } from "@/hooks/useParticipants";

export default function Home() {
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Use React Query hook for smart auto-refreshing
  const { data: participants = [], isLoading, error } = useParticipants(REFRESH_INTERVAL);

  const handleImageClick = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowAlert(true);
  };

  const closeAlert = () => {
    setShowAlert(false);
    setSelectedParticipant(null);
  };

  if (error) {
    return (
      <>
        <header>
          <h1>MORDVEMBER deltakeroversikt</h1>
        </header>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-red-600">Kunne ikke laste deltakere. Prøv igjen senere.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header>
        <h1>MORDVEMBER deltakeroversikt</h1>
      </header>
      <br />
      {isLoading && participants.length === 0 ? (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-600">Laster deltakere...</p>
        </div>
      ) : (
        <ParticipantGrid
          participants={participants}
          onParticipantClick={handleImageClick}
        />
      )}

      {showAlert && selectedParticipant && (
        <ParticipantModal
          participant={selectedParticipant}
          onClose={closeAlert}
        />
      )}
    </>
  );
}
