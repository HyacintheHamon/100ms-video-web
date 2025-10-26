"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HLSPlaybackState,
  HMSHLSPlayer,
  HMSHLSPlayerEvents,
  type HMSHLSLayer,
} from "@100mslive/hls-player";
import { HMSRoomProvider, useHMSStore, selectIsConnectedToRoom, useHMSActions, selectHLSState, selectPeers, useVideo } from "@100mslive/react-sdk";

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

function HLSViewerContent() {
  const [inputUrl, setInputUrl] = useState(
    "https://liveshopping.app.100ms.live/streaming/meeting/yxj-ztjx-mxy"
  );
  const [hlsUrl, setHlsUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HMSHLSPlayer | null>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const hlsState = useHMSStore(selectHLSState);
  const peers = useHMSStore(selectPeers);

  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [layers, setLayers] = useState<HMSHLSLayer[]>([]);
  const [currentLayer, setCurrentLayer] = useState<HMSHLSLayer | null>(null);
  const [volume, setVolume] = useState<number>(100);

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

  // Monitor HLS state from the SDK
  useEffect(() => {
    if (hlsState?.variants && hlsState.variants.length > 0) {
      const hlsUrl = hlsState.variants[0]?.url;
      console.log("[HLS] Got URL from SDK:", hlsUrl);
      if (hlsUrl) {
        setHlsUrl(hlsUrl);
      }
    }
  }, [hlsState]);

  const handleLoad = useCallback(async () => {
    const extractedRoomCode = extractRoomId(inputUrl);
    console.log("[HLS] Room Code extracted:", extractedRoomCode);
    
    if (!extractedRoomCode) {
      setErrorMessage("URL ou Room ID invalide");
      return;
    }
    
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
        try {
          await hmsActions.join({
            userName: 'HLS Viewer',
            authToken,
          });
          console.log("[HLS] Joined room successfully");
        } catch {
          // If join fails, use direct HLS URL without joining
          console.log("[HLS] Join failed, using direct HLS URL");
          const hlsUrl = `https://liveshopping.app.100ms.live/streaming/meeting/${extractedRoomCode}.m3u8`;
          setHlsUrl(hlsUrl);
          setErrorMessage("Lecture directe HLS (sans rejoindre la room)");
        }
      }
      
      // HLS URL will be set by the useEffect monitoring hlsState if join succeeds
      setErrorMessage("");
    } catch (error: unknown) {
      console.error("[HLS] Error:", error);
      // Fallback: use direct HLS URL
      const hlsUrl = `https://liveshopping.app.100ms.live/streaming/meeting/${extractedRoomCode}.m3u8`;
      setHlsUrl(hlsUrl);
      setErrorMessage((error as Error)?.message || "Utilisation de l'URL HLS directe");
    } finally {
      setIsConnecting(false);
    }
  }, [inputUrl, hmsActions, isConnected]);

  useEffect(() => {
    if (!hlsUrl) return;

    console.log("[HLS] Initializing player with URL:", hlsUrl);

    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
      playerRef.current = null;
    }

    const player = new HMSHLSPlayer(hlsUrl, videoRef.current!);
    playerRef.current = player;

    const onError = (_event: HMSHLSPlayerEvents, data: any) => {
      console.error("[HLS] Error:", data);
      setErrorMessage(
        (data?.description as string) || (data?.message as string) || "Erreur HLS"
      );
    };
    const onPlayback = (_e: HMSHLSPlayerEvents, data: { state: HLSPlaybackState }) => {
      setIsPaused(data.state === HLSPlaybackState.paused);
    };
    const onAutoplay = () => setIsAutoplayBlocked(true);
    const onNoLongerLive = (_e: HMSHLSPlayerEvents, data: { isLive: boolean }) => {
      setIsLive(!!data?.isLive);
    };
    const onManifest = (
      _e: HMSHLSPlayerEvents,
      data: { layers: HMSHLSLayer[] }
    ) => {
      setLayers(data.layers || []);
      console.log("[HLS] Manifest loaded:", data.layers);
    };
    const onLayerUpdated = (
      _e: HMSHLSPlayerEvents,
      data: { layer: HMSHLSLayer }
    ) => {
      setCurrentLayer(data.layer || null);
      console.log("[HLS] Layer updated:", data.layer);
    };

    player.on(HMSHLSPlayerEvents.ERROR, onError);
    player.on(HMSHLSPlayerEvents.PLAYBACK_STATE, onPlayback);
    player.on(HMSHLSPlayerEvents.AUTOPLAY_BLOCKED, onAutoplay);
    player.on(HMSHLSPlayerEvents.SEEK_POS_BEHIND_LIVE_EDGE, onNoLongerLive);
    player.on(HMSHLSPlayerEvents.MANIFEST_LOADED, onManifest);
    player.on(HMSHLSPlayerEvents.LAYER_UPDATED, onLayerUpdated);

    try {
      player.setVolume(volume);
    } catch (e) {
      console.error("[HLS] Error setting volume:", e);
    }

    return () => {
      try {
        player.off(HMSHLSPlayerEvents.ERROR, onError);
        player.off(HMSHLSPlayerEvents.PLAYBACK_STATE, onPlayback);
        player.off(HMSHLSPlayerEvents.AUTOPLAY_BLOCKED, onAutoplay);
        player.off(HMSHLSPlayerEvents.SEEK_POS_BEHIND_LIVE_EDGE, onNoLongerLive);
        player.off(HMSHLSPlayerEvents.MANIFEST_LOADED, onManifest);
        player.off(HMSHLSPlayerEvents.LAYER_UPDATED, onLayerUpdated);
        player.pause();
      } catch (e) {
        console.error("[HLS] Error during cleanup:", e);
      }
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [hlsUrl, volume]);

  const canPlay = useMemo(() => !!hlsUrl && !!playerRef.current, [hlsUrl]);

  const handlePlay = async () => {
    try {
      await playerRef.current?.play();
      setIsAutoplayBlocked(false);
    } catch (e: any) {
      setErrorMessage(e?.message || "Impossible de démarrer la lecture");
    }
  };

  const handlePause = () => {
    try {
      playerRef.current?.pause();
    } catch {}
  };

  const handleGoLive = async () => {
    try {
      await playerRef.current?.seekToLivePosition();
    } catch {}
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    try {
      playerRef.current?.setVolume(v);
    } catch {}
  };

  const handleLeave = async () => {
    try {
      if (isConnected) {
        await hmsActions.leave();
        console.log("[HLS] Left room successfully");
      }
      // Clean up HLS player
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setHlsUrl("");
      setErrorMessage("");
      setIsPaused(true);
    } catch (error) {
      console.error("[HLS] Error leaving:", error);
    }
  };

  const handleSelectLayer = (value: string) => {
    const selected = layers.find((l) => l.url === value);
    if (selected) {
      try {
        playerRef.current?.setLayer(selected);
      } catch {}
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
        {hlsUrl ? (
          <p className="text-xs text-zinc-500">URL HLS: {hlsUrl}</p>
        ) : null}
        {isConnected && (
          <p className="text-xs text-green-600 dark:text-green-400">✓ Connecté à la room</p>
        )}
      </div>

      {/* Host Video */}
      {isConnected && peers.length > 0 && (
        <div className="w-full max-w-3xl">
          {(() => {
            // Trouver le host (celui avec le nom "Live Stream Host" ou le rôle host)
            const host = peers.find(peer => 
              peer.name === "Live Stream Host" || 
              peer.roleName === "host" ||
              peer.info?.data?.includes('"isHost":true')
            );
            
            if (host) {
              return (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Stream du Host</h2>
                  <ParticipantVideo peer={host} />
                </div>
              );
            }
            
            return (
              <div className="text-center text-gray-500">
                <p>Aucun host trouvé dans la room</p>
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
