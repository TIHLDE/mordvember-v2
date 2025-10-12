"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Participant } from "@/types/participant";
import { useAuthQuery } from "@/hooks/auth";
import { logoutUser } from "@/api/auth";
import { useParticipants } from "@/hooks/useParticipants";
import { useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "@/components/ConfirmModal";

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth, isLoading: authLoading } = useAuthQuery();
  const { data: participants = [], isLoading: participantsLoading } =
    useParticipants(5000);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    study: "",
    class: "",
    imageUrl: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  const handleParticipantClick = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowConfirm(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedParticipant) return;

    const newStatus = selectedParticipant.status === "alive" ? "dead" : "alive";

    try {
      const response = await fetch("/api/participants", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: selectedParticipant.player,
          status: newStatus,
        }),
      });

      if (response.ok) {
        setMessage(
          `${selectedParticipant.name} er nå markert som ${
            newStatus === "dead" ? "død" : "levende"
          }`
        );
        // Invalidate and refetch participants immediately
        queryClient.invalidateQueries({ queryKey: ["participants"] });
      } else {
        setMessage("Kunne ikke oppdatere status");
      }
    } catch (error) {
      setMessage("Feil ved oppdatering");
      console.error("Failed to update participant:", error);
    } finally {
      setShowConfirm(false);
      setSelectedParticipant(null);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let imageUrl = newParticipant.imageUrl;

      // If an image file is selected, upload it first
      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);
        formData.append("participantName", newParticipant.name);

        const uploadResponse = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
        } else {
          const uploadError = await uploadResponse.json();
          setMessage(`Feil ved opplasting av bilde: ${uploadError.error}`);
          setIsUploading(false);
          return;
        }
      }

      // Create participant with the image URL
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newParticipant,
          imageUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`${data.participant.name} ble lagt til!`);
        // Reset form
        setNewParticipant({ name: "", study: "", class: "", imageUrl: "" });
        setSelectedImage(null);
        setShowAddForm(false);
        // Refresh participants
        queryClient.invalidateQueries({ queryKey: ["participants"] });
      } else {
        const error = await response.json();
        setMessage(`Feil: ${error.error}`);
      }
    } catch (error) {
      setMessage("Feil ved å legge til deltaker");
      console.error("Failed to add participant:", error);
    } finally {
      setIsUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl text-gray-600">Laster...</div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl text-red-600">Ikke autentisert</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-900 mb-2">
                Admin Panel - Mordvember 2025
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-2">
                Klikk på en deltaker for å endre status
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                Innlogget som: {auth.user.firstName} {auth.user.lastName}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition text-sm font-medium"
              >
                {showAddForm ? "Avbryt" : "Legg til deltaker"}
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-900 text-white px-4 py-2 rounded hover:bg-red-800 transition text-sm font-medium"
              >
                Logg ut
              </button>
            </div>
          </div>
          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded mb-2 sm:mb-4 text-sm sm:text-base">
              {message}
            </div>
          )}

          {/* Add Participant Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddParticipant}
              className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Legg til ny deltaker
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Navn *
                  </label>
                  <input
                    type="text"
                    required
                    value={newParticipant.name}
                    onChange={(e) =>
                      setNewParticipant({
                        ...newParticipant,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="Ola Nordmann"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Studie *
                  </label>
                  <input
                    type="text"
                    required
                    value={newParticipant.study}
                    onChange={(e) =>
                      setNewParticipant({
                        ...newParticipant,
                        study: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="Informatikk"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klasse *
                  </label>
                  <input
                    type="text"
                    required
                    value={newParticipant.class}
                    onChange={(e) =>
                      setNewParticipant({
                        ...newParticipant,
                        class: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="1. klasse"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last opp bilde *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedImage(file);
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {selectedImage && (
                    <p className="text-xs text-gray-600 mt-1">
                      Valgt: {selectedImage.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Laster opp..." : "Legg til"}
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setShowAddForm(false);
                    setNewParticipant({
                      name: "",
                      study: "",
                      class: "",
                      imageUrl: "",
                    });
                    setSelectedImage(null);
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {participants.map((participant) => (
            <div
              key={participant.player}
              className={`bg-white rounded-lg shadow-md p-3 sm:p-4 cursor-pointer transition transform active:scale-95 md:hover:scale-105 ${
                participant.status === "dead"
                  ? "border-4 border-red-600"
                  : "border-4 border-green-600"
              }`}
              onClick={() => handleParticipantClick(participant)}
            >
              <div className="flex items-center mb-2 sm:mb-3">
                <Image
                  src={participant.imageUrl}
                  alt={participant.name}
                  width={80}
                  height={80}
                  className={`rounded-full w-16 h-16 sm:w-20 sm:h-20 object-cover ${
                    participant.status === "dead" ? "blood-red" : ""
                  }`}
                />
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                    {participant.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    ID: {participant.player}
                  </p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                <p>
                  <strong>Status:</strong>{" "}
                  {participant.status === "alive" ? "✅ Levende" : "💀 Død"}
                </p>
                <p className="truncate">
                  <strong>Studie:</strong> {participant.study}
                </p>
                <p className="truncate">
                  <strong>Klasse:</strong> {participant.class}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Bekreft statusendring"
        message={
          selectedParticipant
            ? `Er du sikker på at du vil endre status for ${
                selectedParticipant.name
              } fra ${
                selectedParticipant.status === "alive" ? "levende" : "død"
              } til ${
                selectedParticipant.status === "alive" ? "død" : "levende"
              }?`
            : ""
        }
        onConfirm={confirmToggleStatus}
        onCancel={() => {
          setShowConfirm(false);
          setSelectedParticipant(null);
        }}
        confirmText={
          selectedParticipant?.status === "dead"
            ? "Gjør levende igjen"
            : "Ja, DREEEP"
        }
        cancelText="Avbryt"
      />
    </div>
  );
}
