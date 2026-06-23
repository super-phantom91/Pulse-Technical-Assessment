"use client";

import { useEffect, useRef, useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage, type ChatPhase } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import StatusChip from "./components/StatusChip";
import { join, leave, poll, sendEndBeacon, sendSignal } from "@/lib/api";
import { blockPeer, getBlockedIds, isBlocked } from "@/lib/blocklist";
import { flareMeta, parseFlare, type FlareIntent } from "@/lib/flare";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_ACTIVE_MS, POLL_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg } from "@/lib/types";
import FlarePicker from "./components/FlarePicker";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string; flare: FlareIntent }
  | { kind: "incoming"; peerId: string; flare: FlareIntent | null }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 30_000;

/** Main shell: map, chat, flare picker, and connection state machine. */
export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => getBlockedIds());
  const [chatPulse, setChatPulse] = useState(0);
  const [flarePickerPeerId, setFlarePickerPeerId] = useState<string | null>(null);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  /** Keep conn ref in sync for poll loop and timers. */
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  /** Keep video state in sync with poll/control handlers. */
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clear the WebRTC connection timeout. */
  function clearConnectTimer() {
    if (connectTimer.current) {
      clearTimeout(connectTimer.current);
      connectTimer.current = null;
    }
  }

  /** Start a timeout while waiting for WebRTC to connect. */
  function startConnectTimer(peerId: string) {
    clearConnectTimer();
    connectTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "connecting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("Connection timed out.");
      }
    }, CONNECT_TIMEOUT_MS);
  }

  /** Show a temporary toast notice. */
  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  /** Append a chat message and pulse the map tether. */
  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
    setChatPulse((n) => n + 1);
  }

  /** Reset connection, media, and chat state. */
  function teardown(message?: string) {
    if (connRef.current.kind === "idle" && !peerRef.current) return;
    if (requestTimer.current) clearTimeout(requestTimer.current);
    clearConnectTimer();
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setFlarePickerPeerId(null);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  /** Create WebRTC session and wire callbacks. */
  function startPeer(peerId: string, initiator: boolean) {
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, peerId, type, payload);
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onChannelOpen: () => {
        clearConnectTimer();
        setConn({ kind: "connected", peerId });
      },
      onPeerLeft: () => {
        const c = connRef.current;
        if (c.kind !== "connecting" && c.kind !== "connected") return;
        teardown("Stranger disconnected.");
      },
    });
    peerRef.current = ps;
  }

  /** Handle video control messages from the peer. */
  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  /** Open flare intent picker after tapping a peer dot. */
  function openFlarePicker(peerId: string) {
    if (connRef.current.kind !== "idle" || flarePickerPeerId) return;
    setFlarePickerPeerId(peerId);
  }

  /** Dismiss the flare picker without sending a request. */
  function cancelFlarePicker() {
    setFlarePickerPeerId(null);
  }

  /** Send connection request with the chosen flare intent. */
  function sendFlareRequest(flare: FlareIntent) {
    const peerId = flarePickerPeerId;
    if (!peerId || connRef.current.kind !== "idle") return;
    setFlarePickerPeerId(null);
    setConn({ kind: "requesting", peerId, flare });
    void sendSignal(sessionId, peerId, "request", flare);
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  /** Cancel an outbound connection request. */
  /** Cancel an outbound connection request. */
  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  /** Accept an incoming connection and start WebRTC as callee. */
  /** Accept an incoming connection and start WebRTC as callee. */
  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    void sendSignal(sessionId, peerId, "accept");
    setConn({ kind: "connecting", peerId });
    startConnectTimer(peerId);
  }

  /** Decline an incoming connection request. */
  /** Decline an incoming connection request. */
  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void sendSignal(sessionId, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  /** End an active or connecting chat. */
  /** End an active or connecting chat. */
  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(sessionId, c.peerId, "end");
    }
    teardown();
  }

  /** Block peer, end chat, and remove them from the map. */
  /** Block peer, end chat, and remove them from the map for this session. */
  function ghostPeer() {
    const c = connRef.current;
    if (c.kind !== "connecting" && c.kind !== "connected") return;
    const peerId = c.peerId;
    blockPeer(peerId);
    setBlockedIds((prev) => new Set(prev).add(peerId));
    void sendSignal(sessionId, peerId, "end");
    teardown("Ghosted — they won't appear on your map this session.");
  }

  /** Ask the peer to start a video call. */
  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  /** Accept peer video request and share local camera. */
  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  /** Decline peer video request. */
  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  /** Stop local and remote video. */
  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  /** Route one signal mailbox message through the connection state machine. */
  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        if (isBlocked(sig.fromId)) {
          void sendSignal(sessionId, sig.fromId, "decline");
          break;
        }
        if (connRef.current.kind === "idle") {
          setConn({
            kind: "incoming",
            peerId: sig.fromId,
            flare: parseFlare(sig.payload),
          });
        } else {
          void sendSignal(sessionId, sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
          startConnectTimer(sig.fromId);
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request cancelled.");
        } else if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId);
        if (!active) return;
        for (const s of data.signals) processSignalRef.current(s);
        setPeers(data.peers.filter((p) => !blockedIds.has(p.id)));

        const c = connRef.current;
        const peerStillOnline = (id: string) =>
          data.peers.some((p) => p.id === id);

        if (c.kind === "requesting" && !peerStillOnline(c.peerId)) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Stranger left.");
        } else if (c.kind === "incoming" && !peerStillOnline(c.peerId)) {
          setConn({ kind: "idle" });
        } else if (
          (c.kind === "connecting" || c.kind === "connected") &&
          !peerStillOnline(c.peerId)
        ) {
          teardown("Stranger disconnected.");
        }
      } catch {}
      if (active) {
        const c = connRef.current;
        const interval =
          c.kind !== "idle" ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_MS;
        timer = setTimeout(tick, interval);
      }
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId, blockedIds]);

  useEffect(() => {
    if (!sessionId || phase !== "live") return;
    const onLeave = () => {
      const c = connRef.current;
      if (c.kind === "connecting" || c.kind === "connected") {
        sendEndBeacon(sessionId, c.peerId);
      }
      leave(sessionId);
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      leave(sessionId);
    };
  }, [sessionId, phase]);

  /** Join the map after entry gate resolves location. */
  async function handleReady(lat: number, lng: number) {
    const { lat: offsetLat, lng: offsetLng } = await join(sessionId, lat, lng);
    setMyLocation({ lat: offsetLat, lng: offsetLng });
    setPhase("live");
  }

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  const chatPhase: ChatPhase | null =
    conn.kind === "incoming"
      ? "incoming"
      : conn.kind === "requesting"
        ? "waiting"
        : conn.kind === "connecting"
          ? "connecting"
          : conn.kind === "connected"
            ? "connected"
            : null;
  const inChat = chatPhase !== null;
  const connectedPeerId = conn.kind === "connected" ? conn.peerId : null;
  const flarePeerId =
    flarePickerPeerId ??
    (conn.kind === "requesting" || conn.kind === "incoming" ? conn.peerId : null);
  const flareIntent =
    conn.kind === "requesting"
      ? conn.flare
      : conn.kind === "incoming"
        ? conn.flare
        : null;

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={openFlarePicker}
        canConnect={conn.kind === "idle" && !flarePickerPeerId}
        showHint={conn.kind === "idle" && !flarePickerPeerId}
        connectedPeerId={connectedPeerId}
        chatPulse={chatPulse}
        quietSonar={inChat}
        flarePeerId={flarePeerId}
        flareIntent={flareIntent}
      />

      {flarePickerPeerId && (
        <FlarePicker onSelect={sendFlareRequest} onCancel={cancelFlarePicker} />
      )}

      {notice && (
        <StatusChip variant="notice">{notice}</StatusChip>
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title={
            conn.flare
              ? flareMeta(conn.flare).promptTitle
              : "Someone wants to connect"
          }
          subtitle={
            conn.flare
              ? flareMeta(conn.flare).promptSubtitle
              : "Anonymous stranger nearby on the map"
          }
          acceptLabel="Accept"
          declineLabel="Decline"
          flare={conn.flare}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && chatPhase && (
        <ChatPanel
          phase={chatPhase}
          flareIntent={flareIntent}
          messages={messages}
          videoBusy={video !== "none"}
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={
            conn.kind === "requesting"
              ? cancelRequest
              : conn.kind === "incoming"
                ? declineIncoming
                : endConnection
          }
          onGhost={ghostPeer}
        />
      )}

      {video === "requesting" && (
        <StatusChip>Waiting for stranger to accept video…</StatusChip>
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Start video call?"
          subtitle="Your stranger wants to turn on cameras."
          acceptLabel="Accept"
          declineLabel="Decline"
          icon="video"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
