/**
 * The two-player connection panel.
 *
 * With no signalling server the players introduce their own browsers, so this
 * panel's real job is to make a fiddly exchange legible: one numbered step at
 * a time, one thing to copy, one box to paste into, and never both at once.
 *
 * The panel also carries the relay settings. They live here rather than in some
 * general preferences screen because the only moment anybody wants them is the
 * moment a connection has just failed, and that is the moment they are looking
 * at this panel.
 */

import { SignalFormatError, decodeSignal, encodeSignal } from "../net/codec.js";
import {
  type CandidateKind,
  RelayFormatError,
  describeCandidates,
  loadRelay,
  parseRelay,
  saveRelay,
} from "../net/ice.js";
import type { NetMessage } from "../net/protocol.js";
import { type ConnectionState, ManualPeer } from "../net/webrtc.js";
import type { PlayerId } from "../game/types.js";

export interface Link {
  readonly peer: ManualPeer;
  readonly role: PlayerId;
  send(message: NetMessage): void;
}

export interface ConnectHandlers {
  readonly onLink: (link: Link) => void;
  readonly onMessage: (message: NetMessage) => void;
  readonly onState: (state: ConnectionState, detail?: string) => void;
  readonly onHotSeat: () => void;
}

export function createConnectPanel(
  root: HTMLElement,
  handlers: ConnectHandlers,
): { reset: () => void } {
  let peer: ManualPeer | null = null;

  const flowEl = root.querySelector<HTMLElement>("#connect-flow");
  const statusEl = root.querySelector<HTMLElement>("#connect-status");
  if (!flowEl || !statusEl) throw new Error("connect panel markup missing");
  const flow: HTMLElement = flowEl;
  const status: HTMLElement = statusEl;

  const setStatus = (text: string, kind: "" | "good" | "bad" = ""): void => {
    status.textContent = text;
    status.className = `hint ${kind}`;
  };

  const events = {
    onMessage: handlers.onMessage,
    onState: (state: ConnectionState, detail?: string) => {
      handlers.onState(state, detail);
      if (state === "open") {
        setStatus("Connected. Your partner's board is hidden from you.", "good");
        flow.replaceChildren();
      } else if (state === "failed") {
        setStatus(detail ?? "Could not connect", "bad");
      } else if (state === "closed") {
        setStatus("Disconnected", "bad");
      }
    },
  };

  /** One numbered step: a heading, some words, and at most one input. */
  function step(n: number, title: string, body: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "step";
    el.innerHTML = `<h4><span class="n">${n}</span>${title}</h4><p>${body}</p>`;
    return el;
  }

  function codeToCopy(code: string, label: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "code-block";

    const box = document.createElement("textarea");
    box.readOnly = true;
    box.value = code;
    box.rows = 3;
    box.addEventListener("focus", () => box.select());

    const copy = document.createElement("button");
    copy.textContent = `Copy ${label}`;
    copy.addEventListener("click", async () => {
      box.select();
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = "Copied";
      } catch {
        // Clipboard access is refused in some contexts; the text is selected,
        // so Ctrl+C still works and saying so beats a silent failure.
        copy.textContent = "Press Ctrl+C";
      }
      setTimeout(() => (copy.textContent = `Copy ${label}`), 2000);
    });

    wrap.append(box, copy);
    return wrap;
  }

  function pasteBox(label: string, onSubmit: (value: string) => void): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "code-block";

    const box = document.createElement("textarea");
    box.rows = 3;
    box.placeholder = "Paste the code here";
    box.spellcheck = false;

    const go = document.createElement("button");
    go.textContent = label;
    go.addEventListener("click", () => {
      if (box.value.trim().length === 0) {
        setStatus("Nothing pasted yet", "bad");
        return;
      }
      onSubmit(box.value);
    });

    wrap.append(box, go);
    return wrap;
  }

  /** What this browser managed to gather, said plainly, before anything fails. */
  function candidateNote(kinds: ReadonlySet<CandidateKind>): HTMLElement {
    const { text, worrying } = describeCandidates(kinds);
    const el = document.createElement("p");
    el.className = `hint ${worrying ? "bad" : ""}`;
    el.textContent = text;
    return el;
  }

  /**
   * The relay fields, collapsed until wanted. A saved relay is used by the next
   * connection, not this one: changing ICE servers mid-negotiation means tearing
   * down the peer, and quietly invalidating a code the player has already sent
   * is worse than asking them to start again.
   */
  function relaySettings(): HTMLElement {
    const saved = loadRelay();

    const details = document.createElement("details");
    details.className = "relay";
    const summary = document.createElement("summary");
    summary.textContent = saved ? "Connection settings — relay saved" : "Connection settings";
    details.append(summary);

    const blurb = document.createElement("p");
    blurb.className = "hint";
    blurb.textContent =
      "If the connection keeps failing, you are both behind routers that refuse direct connections and the game needs a relay (a TURN server) to pass traffic through. Foghorn does not run one; paste your own here and it is remembered on this browser. The other player needs one too, or the same one.";
    details.append(blurb);

    const url = document.createElement("input");
    url.placeholder = "turns:relay.example.com:5349";
    url.spellcheck = false;
    url.value = saved?.url ?? "";

    const user = document.createElement("input");
    user.placeholder = "username";
    user.spellcheck = false;
    user.value = saved?.username ?? "";

    const secret = document.createElement("input");
    secret.type = "password";
    secret.placeholder = "password";
    secret.value = saved?.credential ?? "";

    const save = document.createElement("button");
    save.textContent = "Save relay";
    save.addEventListener("click", () => {
      try {
        saveRelay(parseRelay(url.value, user.value, secret.value));
        setStatus("Relay saved. Start a new game for it to take effect.", "good");
        summary.textContent = "Connection settings — relay saved";
      } catch (error) {
        setStatus(
          error instanceof RelayFormatError ? error.message : "That relay could not be read",
          "bad",
        );
      }
    });

    const forget = document.createElement("button");
    forget.textContent = "Forget";
    forget.addEventListener("click", () => {
      saveRelay(null);
      url.value = "";
      user.value = "";
      secret.value = "";
      summary.textContent = "Connection settings";
      setStatus("Relay forgotten.", "good");
    });

    const fields = document.createElement("div");
    fields.className = "relay-fields";
    fields.append(url, user, secret, save, forget);
    details.append(fields);
    return details;
  }

  async function startHosting(): Promise<void> {
    flow.replaceChildren(step(1, "Making your code", "Finding your connection details…"));
    setStatus("Working…");

    try {
      const started = await ManualPeer.host(events);
      peer = started.peer;
      const code = await encodeSignal(started.offer);

      const one = step(1, "Send this code to the other player", "Any chat, email or message will do. It is not secret, but it only works for this one game.");
      one.append(codeToCopy(code, "your code"));
      one.append(candidateNote(started.peer.gathered));

      const two = step(2, "Paste their reply", "They will send a code back. Paste it here and you are connected.");
      two.append(
        pasteBox("Connect", async (value) => {
          try {
            setStatus("Connecting…");
            await peer?.acceptAnswer(await decodeSignal(value));
          } catch (error) {
            setStatus(
              error instanceof SignalFormatError ? error.message : "That reply could not be read",
              "bad",
            );
          }
        }),
      );

      flow.replaceChildren(one, two, relaySettings());
      setStatus("Waiting for their reply…");
      handlers.onLink({ peer: started.peer, role: "A", send: (m) => started.peer.send(m) });
    } catch {
      setStatus("Could not start hosting", "bad");
    }
  }

  function startJoining(): void {
    const one = step(1, "Paste the host's code", "They will have sent you one. Paste the whole thing.");
    one.append(
      pasteBox("Make my reply", async (value) => {
        try {
          setStatus("Working…");
          const offer = await decodeSignal<RTCSessionDescriptionInit>(value);
          const joined = await ManualPeer.join(offer, events);
          peer = joined.peer;
          const code = await encodeSignal(joined.answer);

          const two = step(2, "Send this back to the host", "Once they paste it in, the game begins. Keep this page open.");
          two.append(codeToCopy(code, "your reply"));
          two.append(candidateNote(joined.peer.gathered));
          flow.replaceChildren(two, relaySettings());
          setStatus("Waiting for the host…");
          handlers.onLink({ peer: joined.peer, role: "B", send: (m) => joined.peer.send(m) });
        } catch (error) {
          setStatus(
            error instanceof SignalFormatError ? error.message : "That code could not be read",
            "bad",
          );
        }
      }),
    );
    flow.replaceChildren(one, relaySettings());
    setStatus("Paste the code the host sent you.");
  }

  root.querySelector("#host")?.addEventListener("click", () => void startHosting());
  root.querySelector("#join")?.addEventListener("click", () => startJoining());
  root.querySelector("#hotseat")?.addEventListener("click", () => {
    peer?.close();
    peer = null;
    flow.replaceChildren();
    setStatus("Hot seat: both boards on this screen, for one person or two at a desk.");
    handlers.onHotSeat();
  });

  setStatus("Hot seat: both boards on this screen, for one person or two at a desk.");
  return {
    reset(): void {
      peer?.close();
      peer = null;
      flow.replaceChildren();
    },
  };
}
