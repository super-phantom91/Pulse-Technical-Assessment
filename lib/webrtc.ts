export type DescType = "offer" | "answer" | "ice";
export type PeerControl =
  | "video-request"
  | "video-accept"
  | "video-decline"
  | "video-end";

interface PeerCallbacks {
  onSignal: (type: DescType, payload: string) => void;
  onChat: (text: string) => void;
  onControl: (ctrl: PeerControl) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onChannelOpen: () => void;
  onPeerLeft: () => void;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** WebRTC peer connection with chat data channel and optional video. */
export class PeerSession {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private localStream: MediaStream | null = null;
  private closed = false;
  private peerLeftNotified = false;
  private readonly cb: PeerCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  /** @param initiator true when this peer sends the connection offer. */
  constructor(initiator: boolean, cb: PeerCallbacks) {
    this.cb = cb;
    this.polite = !initiator;
    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.cb.onSignal("ice", JSON.stringify(candidate));
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.cb.onSignal("offer", JSON.stringify(this.pc.localDescription));
        }
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.ontrack = ({ streams }) => {
      this.cb.onRemoteStream(streams[0] ?? null);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        this.notifyPeerLeft();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc.iceConnectionState;
      if (ice === "disconnected" || ice === "failed" || ice === "closed") {
        this.notifyPeerLeft();
      }
    };

    if (initiator) {
      this.dc = this.pc.createDataChannel("chat");
      this.wireDataChannel(this.dc);
    } else {
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel;
        this.wireDataChannel(this.dc);
      };
    }
  }

  /** Wire chat and control messages on the data channel. */
  private wireDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => this.cb.onChannelOpen();
    dc.onclose = () => this.notifyPeerLeft();
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.t === "chat" && typeof msg.text === "string") {
          this.cb.onChat(msg.text);
        } else if (msg.t === "ctrl" && typeof msg.ctrl === "string") {
          this.cb.onControl(msg.ctrl as PeerControl);
        }
      } catch {}
    };
  }

  /** Fire onPeerLeft once when the connection drops. */
  private notifyPeerLeft() {
    if (this.closed || this.peerLeftNotified) return;
    this.peerLeftNotified = true;
    this.cb.onPeerLeft();
  }

  /** Apply remote SDP or ICE from the signal mailbox. */
  async handleSignal(type: DescType, payload: string) {
    if (this.closed) return;
    const data = JSON.parse(payload);

    if (type === "ice") {
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(data);
        return;
      }
      try {
        await this.pc.addIceCandidate(data);
      } catch {}
      return;
    }

    const desc = data as RTCSessionDescriptionInit;
    const offerCollision =
      desc.type === "offer" &&
      (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    await this.pc.setRemoteDescription(desc);
    await this.flushPendingCandidates();
    if (desc.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) {
        this.cb.onSignal("answer", JSON.stringify(this.pc.localDescription));
      }
      await this.flushPendingCandidates();
    }
  }

  /** Add ICE candidates queued before remote description was set. */
  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0 || !this.pc.remoteDescription) {
      return;
    }
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  /** Send a chat message over the data channel. */
  sendChat(text: string) {
    this.safeSend({ t: "chat", text });
  }

  /** Send a video control message over the data channel. */
  sendControl(ctrl: PeerControl) {
    this.safeSend({ t: "ctrl", ctrl });
  }

  /** Send JSON on the data channel when open. */
  private safeSend(obj: unknown) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(obj));
    }
  }

  /** Acquire camera/mic and add tracks to the peer connection. */
  async startVideo(): Promise<MediaStream> {
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
    return this.localStream;
  }

  /** Stop local video tracks and remove them from the connection. */
  stopVideo() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      for (const sender of this.pc.getSenders()) {
        if (sender.track) {
          try {
            this.pc.removeTrack(sender);
          } catch {}
        }
      }
      this.localStream = null;
    }
  }

  /** Tear down the peer connection and local media. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopVideo();
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
    }
    try {
      this.pc.close();
    } catch {}
  }
}
