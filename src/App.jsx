import { useState, useRef, useCallback, useLayoutEffect } from "react";

let _uid = 0;
const uid = () => `u${++_uid}`;
const makeTextNode = (text = "") => ({ kind: "text", id: uid(), text });
const makeGroupNode = (lines = []) => ({
    kind: "group",
    id: uid(),
    items: lines.map((text) => ({ id: uid(), text, state: "neutral" })),
});

/* ─── Styles ──────────────────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f0f0f0; --paper: #faf7f2;
    --ink: #2a2118; --ink-light: #7a6e5f; --ink-faint: #c5bfb2;
    --success: #3a7d44; --success-oval: #4a9957;
    --failure: #b83232; --failure-oval: #c94040;
    --neutral-bg: #ede8df; --accent: #c4783a;
    --shadow-deep: 0 8px 40px rgba(42,33,24,0.14);
    --radius: 12px;
  }

  body {
    font-family: 'Lora', serif; background: var(--bg);
    min-height: 100vh; display: flex;
    align-items: flex-start; justify-content: center;
    padding: 40px 16px 80px;
  }

  .app { width: 100%; max-width: 680px; }

  .header { margin-bottom: 28px; padding: 0 4px; }
  .header h1 {
    font-family: 'Playfair Display', serif;
    font-size: 2.2rem; font-weight: 600;
    color: var(--ink); letter-spacing: -0.02em; line-height: 1.1;
  }
  .header p { font-size: 0.88rem; color: var(--ink-light); margin-top: 6px; font-style: italic; }

  .editor-card {
    background: var(--paper); border-radius: var(--radius);
    box-shadow: var(--shadow-deep); overflow: hidden;
    border: 1px solid rgba(42,33,24,0.08);
  }

  .toolbar {
    display: flex; align-items: center; gap: 4px;
    padding: 10px 14px; border-bottom: 1px solid var(--ink-faint);
    background: rgba(245,240,232,0.6);
  }
  .toolbar-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 6px;
    border: none; background: var(--ink); color: var(--paper);
    font-family: 'Lora', serif; font-size: 0.8rem;
    cursor: pointer; transition: background 0.15s; white-space: nowrap;
  }
  .toolbar-btn:hover { background: #3d3128; }
  .toolbar-hint {
    margin-left: auto; font-size: 0.75rem;
    color: var(--ink-faint); font-style: italic; font-family: 'Lora', serif;
  }

  .editor-body { padding: 28px 32px; min-height: 320px; }
  .doc { display: flex; flex-direction: column; }

  /* Verdict group: position:relative so items can be read with getBoundingClientRect */
  .verdict-group { display: flex; flex-direction: column; position: relative; margin: 4px 0; }

  .verdict-row {
    display: flex; align-items: center; gap: 14px;
    padding: 5px 0;
    /* will-change helps browser pre-composite layers for smoother animation */
    will-change: transform;
  }

  /* OVAL */
  .oval {
    flex-shrink: 0; width: 64px; height: 28px; border-radius: 14px;
    position: relative; overflow: hidden;
    border: 1.5px solid var(--ink-faint); background: var(--neutral-bg);
    transition: transform 0.12s, box-shadow 0.12s; cursor: pointer;
  }
  .oval:hover { transform: scale(1.06); box-shadow: 0 2px 8px rgba(42,33,24,0.12); }
  .oval:active { transform: scale(0.97); }
  .oval.success { background: linear-gradient(135deg,#c8e6cb,#a5d6a7); border-color: var(--success-oval); }
  .oval.failure { background: linear-gradient(135deg,#ffcdd2,#ef9a9a); border-color: var(--failure-oval); }

  .oval-half {
    position: absolute; top: 0; width: 50%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  .oval-half.L { left: 0; border-right: 1px solid rgba(42,33,24,0.08); }
  .oval-half.R { right: 0; }
  .oval-half svg { opacity: 0.4; transition: opacity 0.12s; }
  .oval:hover .oval-half svg { opacity: 0.65; }
  .oval.success .oval-half.L svg { opacity: 1; color: var(--success); }
  .oval.success .oval-half.R svg { opacity: 0.22; }
  .oval.failure .oval-half.R svg { opacity: 1; color: var(--failure); }
  .oval.failure .oval-half.L svg { opacity: 0.22; }

  .oval-pip {
    position: absolute; top: 50%; left: 50%;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--ink-faint);
    transform: translate(-50%,-50%);
    transition: background 0.18s, left 0.18s;
    pointer-events: none; z-index: 2;
  }
  .oval.success .oval-pip { background: var(--success); left: calc(50% - 12px); }
  .oval.failure .oval-pip { background: var(--failure); left: calc(50% + 12px); }

  .vtext {
    font-family: 'Lora', serif; font-size: 1rem;
    color: var(--ink); line-height: 1.5; flex: 1; transition: color 0.25s;
  }
  .vtext.success { color: var(--success); }
  .vtext.failure { color: var(--ink-light); text-decoration: line-through; text-decoration-color: var(--failure-oval); }

  .legend {
    display: flex; gap: 20px; justify-content: center;
    margin-top: 18px; font-size: 0.75rem;
    color: var(--ink-light); font-style: italic; font-family: 'Lora', serif;
  }
  .legend span { display: flex; align-items: center; gap: 5px; }
`;

const IcoOval = () => (
    <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
    >
        <rect x="1" y="1" width="14" height="10" rx="5" />
        <line
            x1="8"
            y1="2"
            x2="8"
            y2="10"
            strokeDasharray="1.5 1.5"
            strokeWidth="1"
            opacity="0.5"
        />
    </svg>
);
const IcoCheck = () => (
    <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="1,4.5 3.5,7 8,1.5" />
    </svg>
);
const IcoX = () => (
    <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
    >
        <line x1="1.5" y1="1.5" x2="7.5" y2="7.5" />
        <line x1="7.5" y1="1.5" x2="1.5" y2="7.5" />
    </svg>
);

/* ─── Oval widget ─────────────────────────────────────────────────────── */

function Oval({ state, onLeft, onRight }) {
    const cls =
        state === "success" ? "success" : state === "failure" ? "failure" : "";
    return (
        <div className={`oval ${cls}`}>
            <div
                className="oval-half L"
                onClick={(e) => {
                    e.stopPropagation();
                    onLeft();
                }}
            >
                <IcoCheck />
            </div>
            <div className="oval-pip" />
            <div
                className="oval-half R"
                onClick={(e) => {
                    e.stopPropagation();
                    onRight();
                }}
            >
                <IcoX />
            </div>
        </div>
    );
}

function VerdictGroup({ node, onClassify }) {
    const itemRefs = useRef({}); // itemId → DOM row element
    const snapRef = useRef(null); // snapshot taken synchronously before state update
    const itemsRef = useRef(node.items);
    itemsRef.current = node.items;

    // FLIP step 1 — called synchronously inside the click handler, before setState
    const snapshot = () => {
        const map = {};
        for (const [id, el] of Object.entries(itemRefs.current)) {
            if (el) map[id] = el.getBoundingClientRect().top;
        }
        snapRef.current = map;
    };

    // FLIP steps 3 & 4 — runs synchronously after React commits the new DOM
    useLayoutEffect(() => {
        const prev = snapRef.current;
        if (!prev) return;
        snapRef.current = null; // consume it

        const DURATION = 420;
        const EASING = "cubic-bezier(0.34, 1.10, 0.64, 1)"; // slight overshoot spring

        for (const [id, el] of Object.entries(itemRefs.current)) {
            if (!el || prev[id] == null) continue;
            const delta = prev[id] - el.getBoundingClientRect().top; // invert: old minus new
            if (Math.abs(delta) < 0.5) continue;

            // Cancel any running animation on this element first
            el.getAnimations().forEach((a) => a.cancel());

            el.animate(
                [
                    { transform: `translateY(${delta}px)`, easing: EASING },
                    { transform: "translateY(0px)" },
                ],
                { duration: DURATION, fill: "none" }
            );
        }
    }); // no dep array — runs after every render, but snapRef guards it

    return (
        <div className="verdict-group">
            {node.items.map((item) => (
                <div
                    key={item.id}
                    className="verdict-row"
                    ref={(el) => {
                        if (el) itemRefs.current[item.id] = el;
                        else delete itemRefs.current[item.id];
                    }}
                >
                    <Oval
                        state={item.state}
                        onLeft={() => {
                            snapshot();
                            onClassify(node.id, item.id, "success");
                        }}
                        onRight={() => {
                            snapshot();
                            onClassify(node.id, item.id, "failure");
                        }}
                    />
                    <span className={`vtext ${item.state}`}>{item.text}</span>
                </div>
            ))}
        </div>
    );
}

/* ─── Main App ────────────────────────────────────────────────────────── */

export default function App() {
    const [phase, setPhase] = useState("editing");
    const [rawText, setRawText] = useState("");
    const [listTitle, setListTitle] = useState("Verdict List");
    const [ratio, setRatio] = useState(null);
    const [nodes, setNodes] = useState([]);
    const editorRef = useRef(null);
    const textareaRefs = useRef({});

    /* ── Convert from initial textarea ── */

    const handleConvert = useCallback(() => {
        const ta = editorRef.current;
        if (!ta) return;

        const full = ta.value ?? "";
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? full.length;

        const lineStart = full.lastIndexOf("\n", start - 1) + 1;
        let lineEnd = full.indexOf("\n", end);
        if (lineEnd === -1) lineEnd = full.length;

        const before = full.slice(0, lineStart);
        const selected = full.slice(lineStart, lineEnd);
        const after = full.slice(lineEnd);

        const selectedLines = selected
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        if (!selectedLines.length) return;

        // Strip the single \n that separates before/after from the selected block —
        // the group's own block-level rendering provides that visual separation.
        const beforeText = before.endsWith("\n") ? before.slice(0, -1) : before;
        const afterText = after.startsWith("\n") ? after.slice(1) : after;

        const newNodes = [];
        if (beforeText.length > 0) newNodes.push(makeTextNode(beforeText));
        newNodes.push(makeGroupNode(selectedLines));
        if (afterText.length > 0) newNodes.push(makeTextNode(afterText));

        setNodes(newNodes);
        setPhase("doc");

        const firstLine = full.split("\n").find(l => l.trim()) || "Verdict List";
        document.title = firstLine;
        setListTitle(firstLine);
    }, []);

    /* ── Convert from a text node in doc phase ── */

    const handleConvertDoc = useCallback(() => {
        const activeEl = document.activeElement;
        let focusedNodeId = null;
        for (const [id, el] of Object.entries(textareaRefs.current)) {
            if (el === activeEl) {
                focusedNodeId = id;
                break;
            }
        }
        if (!focusedNodeId) return;

        const ta = textareaRefs.current[focusedNodeId];
        if (!ta) return;

        const full = ta.value ?? "";
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? full.length;

        const lineStart = full.lastIndexOf("\n", start - 1) + 1;
        let lineEnd = full.indexOf("\n", end);
        if (lineEnd === -1) lineEnd = full.length;

        const before = full.slice(0, lineStart);
        const selected = full.slice(lineStart, lineEnd);
        const after = full.slice(lineEnd);

        const selectedLines = selected
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        if (!selectedLines.length) return;

        const beforeText = before.endsWith("\n") ? before.slice(0, -1) : before;
        const afterText = after.startsWith("\n") ? after.slice(1) : after;

        setNodes((prev) => {
            const idx = prev.findIndex((n) => n.id === focusedNodeId);
            if (idx === -1) return prev;
            const replacement = [];
            if (beforeText.length > 0) replacement.push(makeTextNode(beforeText));
            replacement.push(makeGroupNode(selectedLines));
            if (afterText.length > 0) replacement.push(makeTextNode(afterText));
            return [...prev.slice(0, idx), ...replacement, ...prev.slice(idx + 1)];
        });
    }, []);

    const classify = useCallback((groupId, itemId, newState) => {
        setNodes((prev) => {
            const next = prev.map((node) => {
                if (node.kind !== "group" || node.id !== groupId) return node;

                const items = node.items;
                const item = items.find((i) => i.id === itemId);
                if (!item) return node;

                if (item.state === newState) {
                    return {
                        ...node,
                        items: items.map((i) =>
                            i.id === itemId ? { ...i, state: "neutral" } : i
                        ),
                    };
                }

                const rest = items.filter((i) => i.id !== itemId);
                const updated = { ...item, state: newState };

                let reordered;
                if (newState === "success") {
                    const lastSuccessIdx = rest.reduce(
                        (acc, r, i) => (r.state === "success" ? i : acc),
                        -1
                    );
                    const at = lastSuccessIdx + 1;
                    reordered = [...rest.slice(0, at), updated, ...rest.slice(at)];
                } else {
                    const firstFailIdx = rest.findIndex((r) => r.state === "failure");
                    reordered =
                        firstFailIdx === -1
                            ? [...rest, updated]
                            : [...rest.slice(0, firstFailIdx), updated, ...rest.slice(firstFailIdx)];
                }

                return { ...node, items: reordered };
            });

            const allItems = next.flatMap((n) => n.kind === "group" ? n.items : []);
            const total = allItems.length;
            const succeeded = allItems.filter((i) => i.state === "success").length;
            const failed = allItems.filter((i) => i.state === "failure").length;
            if (total > 0 && succeeded + failed === total) {
                setRatio({ succeeded: Math.round((succeeded / total) * 100), failed: Math.round((failed / total) * 100) });
            } else {
                setRatio(null);
            }

            return next;
        });
    }, []);

    /* ── Render ── */

    return (
        <>
            <style>{STYLES}</style>
            <div className="app">
                <div className="header">
                    <h1>{listTitle}</h1>
                    <p>
                        Type your items, select a block of texts, then hit "Make List" to
                        start
                    </p>
                </div>

                <div className="editor-card">
                    <div className="toolbar">
                        <button
                            className="toolbar-btn"
                            onClick={phase === "editing" ? handleConvert : handleConvertDoc}
                        >
                            <IcoOval />
                            Make List
                        </button>
                        {ratio && (
                            <span style={{ fontSize: "0.8rem", color: "var(--ink-light)", fontFamily: "'Lora', serif", fontStyle: "italic" }}>
                                Succeeded: {ratio.succeeded}%, Failed: {ratio.failed}%
                            </span>
                        )}
                    </div>

                    <div className="editor-body">
                        {phase === "editing" ? (
                            <textarea
                                ref={editorRef}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                placeholder={
                                    "Start typing, one item per line…\n\nFinished the design prototype\nAttend the 3pm meeting\nGrocery shopping\nEmail the team"
                                }
                                rows={10}
                                style={{
                                    width: "100%",
                                    border: "none",
                                    outline: "none",
                                    resize: "none",
                                    background: "transparent",
                                    fontFamily: "'Lora', serif",
                                    fontSize: "1rem",
                                    color: "var(--ink)",
                                    lineHeight: "1.85",
                                    caretColor: "var(--accent)",
                                    padding: 0,
                                }}
                            />
                        ) : (
                            <div className="doc">
                                {nodes.map((node) => {
                                    if (node.kind === "text") {
                                        const lineCount = (node.text.match(/\n/g) || []).length + 1;
                                        return (
                                            <textarea
                                                key={node.id}
                                                ref={(el) => {
                                                    if (el) textareaRefs.current[node.id] = el;
                                                    else delete textareaRefs.current[node.id];
                                                }}
                                                value={node.text}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setNodes((prev) =>
                                                        prev.map((n) =>
                                                            n.id === node.id ? { ...n, text: val } : n
                                                        )
                                                    );
                                                }}
                                                rows={Math.max(lineCount, 1)}
                                                style={{
                                                    width: "100%",
                                                    border: "none",
                                                    outline: "none",
                                                    resize: "none",
                                                    background: "transparent",
                                                    fontFamily: "'Lora', serif",
                                                    fontSize: "1rem",
                                                    color: "var(--ink)",
                                                    lineHeight: "1.85",
                                                    caretColor: "var(--accent)",
                                                    padding: 0,
                                                    display: "block",
                                                    overflow: "hidden",
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <VerdictGroup
                                            key={node.id}
                                            node={node}
                                            onClassify={classify}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="legend"></div>
            </div>
        </>
    );
}
