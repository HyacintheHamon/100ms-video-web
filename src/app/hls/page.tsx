"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HMSRoomProvider, useHMSStore, selectIsConnectedToRoom, useHMSActions, selectPeers, useVideo, selectRoomState, selectRoom, type HMSPeer } from "@100mslive/react-sdk";

//

function ParticipantVideo({ peer }: { peer: { id: string; name?: string; videoTrack?: string; isLocal?: boolean } }) {
  const { videoRef } = useVideo({
    trackId: peer.videoTrack,
  });

  if (!peer.videoTrack) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">
              {peer.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <p className="text-sm text-gray-400">Camera Off</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted={peer.isLocal}
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        {peer.name || 'Anonymous'}
      </div>
    </div>
  );
}

// Phase reducer based only on room state + endedAt + wasLive memory
function useStreamPhase(): "upcoming" | "live" | "ended" {
  const roomState = useHMSStore(selectRoomState);
  const room = useHMSStore(selectRoom);
  const wasLiveRef = useRef(false);

  const isLiveNow = roomState === "Connected";
  useEffect(() => {
    if (isLiveNow) wasLiveRef.current = true;
  }, [isLiveNow]);

  const endedAt = (room as unknown as { endedAt?: string | number | Date } | null | undefined)?.endedAt;
  const [phase, setPhase] = useState<"upcoming" | "live" | "ended">("upcoming");
  useEffect(() => {
    if (endedAt) {
      setPhase("ended");
      return;
    }
    if (roomState === "Connected") {
      setPhase("live");
      return;
    }
    if (wasLiveRef.current && (roomState === "Disconnecting" || roomState === "Disconnected")) {
      setPhase("ended");
      return;
    }
    setPhase("upcoming");
  }, [roomState, endedAt]);

  return phase;
}

function HLSViewerContent() {
  const [inputUrl, setInputUrl] = useState(
    "https://liveshopping.app.100ms.live/streaming/meeting/yxj-ztjx-mxy"
  );
  const [roomId, setRoomId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const phase = useStreamPhase();

  // Leave on unmount to avoid ghost states
  useEffect(() => {
    return () => {
      hmsActions.leave().catch(() => {});
    };
  }, [hmsActions]);

  // Extract room ID from URL
  function extractRoomId(url: string): string {
    try {
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(/\/streaming\/meeting\/([^\/]+)/);
      if (match) return match[1];
      // If no match, try direct room ID
      const roomMatch = url.match(/^[a-zA-Z0-9-_]+$/);
      return roomMatch ? roomMatch[0] : "";
    } catch {
      // If not a URL, treat as room ID directly
      return url.trim();
    }
  }

  const handleLoad = useCallback(async () => {
    const extractedRoomCode = extractRoomId(inputUrl);
    console.log("[HLS] Room Code extracted:", extractedRoomCode);
    
    if (!extractedRoomCode) {
      setErrorMessage("URL ou Room ID invalide");
      return;
    }
    
    setHasLoaded(true);
    setRoomId(extractedRoomCode);
    setIsConnecting(true);
    setErrorMessage("");
    
    try {
      // Use getAuthTokenByRoomCode to get a token from the room code
      console.log("[HLS] Getting auth token for room code:", extractedRoomCode);
      
      const authToken = await hmsActions.getAuthTokenByRoomCode({
        roomCode: extractedRoomCode,
      });
      
      console.log("[HLS] Got auth token, joining room...");
      
      if (!isConnected) {
        await hmsActions.join({
          userName: 'HLS Viewer',
          authToken,
          settings: {
            isAudioMuted: true,
            isVideoMuted: true,
          },
        });
        console.log("[HLS] Joined room successfully");
        // Force listen-only: immediately disable local media
        try {
          await hmsActions.setLocalAudioEnabled(false);
          await hmsActions.setLocalVideoEnabled(false);
        } catch {}
      }
      
      setErrorMessage("");
    } catch (error: unknown) {
      console.error("[HLS] Error:", error);
      setErrorMessage((error as Error)?.message || "Erreur de connexion");
    } finally {
      setIsConnecting(false);
    }
  }, [inputUrl, hmsActions, isConnected]);

  const handleLeave = async () => {
    try {
      if (isConnected) {
        await hmsActions.leave();
        console.log("[HLS] Left room successfully");
      }
      setErrorMessage("");
    } catch (error) {
      console.error("[HLS] Error leaving:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Lecteur HLS 100ms (Viewer)</h1>
      
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="meetingUrl">
          URL de meeting ou Room ID
        </label>
        <input
          id="meetingUrl"
          className="w-full rounded-md border border-black/10 p-3 text-sm dark:border-white/15"
          placeholder="Collez l'URL de meeting 100ms ou un Room ID"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
        />
        <button
          className="h-10 w-full rounded-md bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85 disabled:opacity-50"
          onClick={handleLoad}
          disabled={isConnecting}
        >
          {isConnecting ? "Connexion..." : "Charger le flux"}
        </button>
        {roomId && (
          <p className="text-xs text-zinc-500">Room ID: {roomId}</p>
        )}
        {isConnected && (
          <p className="text-xs text-green-600 dark:text-green-400">✓ Connecté à la room</p>
        )}
      </div>

      {/* Écrans dépendants de la phase */}
      {hasLoaded && (
        <div className="w-full max-w-3xl">
          {(() => {
            console.log("[HLS] Render decision phase:", { phase, isConnected, peers: peers.length });

            // Écran de fin de stream
            if (phase === "ended") {
              return (
                <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Le stream est terminé
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Merci d&apos;avoir regardé le stream !
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Vous pouvez fermer cette page ou rejoindre un autre stream
                    </div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      onClick={() => {
                        console.log("[HLS] Resetting states");
                        setHasLoaded(false);
                      }}
                    >
                      Rejoindre un nouveau stream
                    </button>
                  </div>
                </div>
              );
            }
            // Phase live: afficher le premier remote avec video, sinon attente courte
            if (phase === "live") {
              const firstWithVideo = peers.find(p => p.videoTrack && !p.isLocal);
              if (firstWithVideo) {
                return (
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Direct</h2>
                    <ParticipantVideo peer={firstWithVideo} />
                  </div>
                );
              }
              // attente courte si pas encore de track reçue
              return (
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Connexion au direct…</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Réception des pistes en cours…</p>
                  </div>
                </div>
              );
            }

            // phase === "upcoming"
            return (
              <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Le stream va bientôt commencer
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Nous attendons le démarrage du stream…
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3">
        <button
          className="h-9 rounded-md bg-red-600 px-4 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          onClick={handleLeave}
          disabled={!isConnected}
        >
          Quitter
        </button>
      </div>

      {errorMessage ? (
        <div className="w-full max-w-3xl rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}
      
    </div>
  );
}

export default function HLSViewerPage() {
  return (
    <HMSRoomProvider>
      <HLSViewerContent />
    </HMSRoomProvider>
  );
}