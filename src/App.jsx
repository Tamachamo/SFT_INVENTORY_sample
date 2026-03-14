import React, { useEffect, useMemo, useState, useRef } from "react";

const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL;

function uniq(arr) {
  return Array.from(new Set(arr.filter((v) => v !== "" && v !== null && v !== undefined)));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function fmt2(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "";
  return round2(v).toFixed(2);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState([]);

  // inputs
  const [code, setCode] = useState("");
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [dia, setDia] = useState("");

  const [newMode, setNewMode] = useState(false);

  const [location, setLocation] = useState("");
  const [qty, setQty] = useState("");

  // optional
  const [hon, setHon] = useState("");
  const [note, setNote] = useState("");

  // 前月データ
  const [previousQty, setPreviousQty] = useState(null);
  const [previousLoading, setPreviousLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  // ========== 高速化：キャッシュ & AbortController ==========
  const prevDataCacheRef = useRef({});
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  // ======================================================

  // ---- styles
  const styles = {
    page: {
      minHeight: "100vh",
      background: "#fafafa",
      color: "#111",
      padding: 16,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    },
    card: {
      maxWidth: 640,
      margin: "0 auto",
      background: "#fff",
      border: "1px solid #eaeaea",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
    },
    titleRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "baseline",
      flexWrap: "wrap",
      marginBottom: 8,
    },
    h1: { margin: 0, fontSize: 22, letterSpacing: 0.2 },
    sub: { margin: 0, opacity: 0.7, fontSize: 13 },
    alert: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #e5e5e5",
      background: "#fcfcfc",
      fontSize: 14,
      whiteSpace: "pre-wrap",
    },
    form: { marginTop: 14 },
    section: {
      display: "grid",
      gap: 12,
    },
    row2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
    },
    row2Mobile: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 12,
    },
    field: { display: "grid", gap: 6 },
    label: { fontSize: 13, fontWeight: 700 },
    help: { fontSize: 12, opacity: 0.65, marginTop: -2 },
    input: {
      width: "100%",
      height: 44,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid #d9d9d9",
      outline: "none",
      fontSize: 14,
      background: "#fff",
    },
    select: {
      width: "100%",
      height: 44,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid #d9d9d9",
      outline: "none",
      fontSize: 14,
      background: "#fff",
    },
    textarea: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #d9d9d9",
      outline: "none",
      fontSize: 14,
      background: "#fff",
      resize: "vertical",
      minHeight: 90,
    },
    checkRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      border: "1px solid #efefef",
      borderRadius: 12,
      background: "#fafafa",
    },
    btn: {
      width: "100%",
      height: 48,
      borderRadius: 14,
      border: "none",
      fontWeight: 800,
      fontSize: 15,
      cursor: "pointer",
    },
    btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
    previousDataBox: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "2px solid #4CAF50",
      background: "#f1f8f4",
      fontSize: 13,
    },
    previousDataLoading: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #ffb74d",
      background: "#fff8e1",
      fontSize: 13,
    },
  };

  // ---- data
  async function fetchMaster() {
    if (!GAS_WEBAPP_URL) throw new Error("VITE_GAS_WEBAPP_URL が未設定です");

    const res = await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "master" }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "master取得失敗");
    setMaster(data.master || []);
  }

  // ========== 前月データ取得（高速化版） ==========
  async function fetchPreviousData(productCode) {
    if (!productCode.trim()) {
      setPreviousQty(null);
      return;
    }

    // キャッシュをチェック
    if (prevDataCacheRef.current[productCode] !== undefined) {
      setPreviousQty(prevDataCacheRef.current[productCode]);
      return;
    }

    setPreviousLoading(true);

    // 前のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const controller = abortControllerRef.current;
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "getPreviousMonth",
          code: productCode.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.ok && data.previousData) {
        const qty = data.previousData.qty;
        setPreviousQty(qty);
        // キャッシュに保存
        prevDataCacheRef.current[productCode] = qty;
      } else {
        setPreviousQty(null);
        prevDataCacheRef.current[productCode] = null;
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("���月データ取得エラー:", e);
      }
      setPreviousQty(null);
      prevDataCacheRef.current[productCode] = null;
    } finally {
      setPreviousLoading(false);
    }
  }
  // ==============================================

  // ========== 初期化（高速化） ==========
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchMaster();
      } catch (e) {
        setMsg(`❌ ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  // ==================================

  // code -> autofill + 前月データ取得（デバウンス付き）
  useEffect(() => {
    const c = code.trim();

    // 前のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!c) {
      setPreviousQty(null);
      return;
    }

    const hit = master.find((r) => String(r.code) === c);
    if (hit) {
      setMaker(hit.maker || "");
      setModel(hit.model || "");
      setDia(hit.dia !== null && hit.dia !== undefined ? String(hit.dia) : "");
      setNewMode(false);
      setMsg("");
    }

    // デバウンス：入力が止まってから200ms後に前月データ取得
    debounceTimerRef.current = setTimeout(() => {
      fetchPreviousData(c);
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [code, master]);

  // dropdown options
  const makerOptions = useMemo(
    () => uniq(master.map((r) => r.maker)).sort((a, b) => String(a).localeCompare(String(b), "ja")),
    [master]
  );

  const modelOptions = useMemo(() => {
    const m = maker.trim();
    if (!m) return [];
    return uniq(master.filter((r) => r.maker === m).map((r) => r.model)).sort((a, b) =>
      String(a).localeCompare(String(b), "ja")
    );
  }, [master, maker]);

  const diaOptions = useMemo(() => {
    const m = maker.trim();
    const mo = model.trim();
    if (!m || !mo) return [];
    const list = master
      .filter((r) => r.maker === m && r.model === mo)
      .map((r) => r.dia)
      .filter((v) => v !== null && v !== undefined);
    return uniq(list)
      .sort((a, b) => Number(a) - Number(b))
      .map((x) => String(x));
  }, [master, maker, model]);

  useEffect(() => {
    if (newMode) return;
    const m = maker.trim();
    const mo = model.trim();
    const d = Number(dia);
    if (!m || !mo || Number.isNaN(d)) return;

    const hit = master.find(
      (r) =>
        r.maker === m &&
        r.model === mo &&
        r.dia !== null &&
        Math.abs(Number(r.dia) - d) < 1e-9
    );
    if (hit) setCode(String(hit.code));
  }, [maker, model, dia, master, newMode]);

  function validateRequired() {
    if (!location) return "保管場所を選択して";
    const q = Number(qty);
    if (Number.isNaN(q)) return "数量が数値じゃない";

    if (code.trim()) return null;

    if (!maker.trim()) return "メーカーを選択/入力して";
    if (!model.trim()) return "型式を選択/入力して";
    const d = Number(dia);
    if (Number.isNaN(d)) return "線径が数値じゃない";
    return null;
  }

  function resetForm() {
    setCode("");
    setMaker("");
    setModel("");
    setDia("");
    setLocation("");
    setQty("");
    setHon("");
    setNote("");
    setNewMode(false);
    setPreviousQty(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    const err = validateRequired();
    if (err) return setMsg(`❌ ${err}`);

    setSending(true);
    try {
      const payload = {
        action: "submit",
        code: code.trim() || "",
        maker: maker.trim() || "",
        model: model.trim() || "",
        dia: dia === "" ? "" : Number(dia),
        location,
        qty: Number(qty),
        hon: hon.trim() || "",
        note: note.trim() || "",
      };

      const res = await fetch(GAS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "送信失敗");

      // ========== 送信後：キャッシュクリア ==========
      prevDataCacheRef.current = {};
      // ===========================================

      await fetchMaster();
      resetForm();
      setMsg("✅ 送信完了（次どうぞ）");
    } catch (e2) {
      setMsg(`❌ ${e2.message}`);
    } finally {
      setSending(false);
    }
  }

  const disabledAll = loading || sending;

  const isNarrow = typeof window !== "undefined" ? window.innerWidth < 520 : false;
  const row2Style = isNarrow ? styles.row2Mobile : styles.row2;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <h1 style={styles.h1}>SFT 送信フォーム</h1>
          <p style={styles.sub}>
            {loading ? "読込中..." : `マスタ件数：${master.length}`}
          </p>
        </div>

        {msg && <div style={styles.alert}>{msg}</div>}

        <form onSubmit={onSubmit} style={styles.form}>
          <fieldset
            disabled={disabledAll}
            style={{ border: "none", padding: 0, margin: 0 }}
          >
            <div style={styles.section}>
              {/* コード */}
              <div style={styles.field}>
                <div style={styles.label}>コード（入力すると自動補完）</div>
                <input
                  style={styles.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="例: 123"
                />
                <div style={styles.help}>
                  ※コードがある場合はコード優先でマスタ参照
                </div>
              </div>

              {/* 新規モード */}
              <div style={styles.checkRow}>
                <input
                  id="newMode"
                  type="checkbox"
                  checked={newMode}
                  onChange={(e) => setNewMode(e.target.checked)}
                />
                <label htmlFor="newMode" style={{ fontSize: 13, fontWeight: 700 }}>
                  マスタに無い種類を入力（新規登録）
                </label>
              </div>
              <div style={styles.help}>
                ※すでに登録されているメーカーや型式のマスタ登録をする場合は、初めにメーカーや型式を選択してから☑してください。
              </div>

              {/* メーカー・型式 */}
              <div style={row2Style}>
                <div style={styles.field}>
                  <div style={styles.label}>メーカー（必須）</div>
                  {newMode ? (
                    <input
                      style={styles.input}
                      value={maker}
                      onChange={(e) => setMaker(e.target.value)}
                      placeholder="例: プロテリアル"
                    />
                  ) : (
                    <select
                      style={styles.select}
                      value={maker}
                      onChange={(e) => {
                        setMaker(e.target.value);
                        setModel("");
                        setDia("");
                        setCode("");
                      }}
                    >
                      <option value="">選択してください</option>
                      {makerOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={styles.field}>
                  <div style={styles.label}>型式（必須）</div>
                  {newMode ? (
                    <input
                      style={styles.input}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="例: 2AMW-XV"
                    />
                  ) : (
                    <select
                      style={styles.select}
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        setDia("");
                        setCode("");
                      }}
                      disabled={!maker}
                    >
                      <option value="">選択してください</option>
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 線径・保管場所 */}
              <div style={row2Style}>
                <div style={styles.field}>
                  <div style={styles.label}>線径（必須・数値）</div>
                  {newMode ? (
                    <input
                      style={styles.input}
                      value={dia}
                      onChange={(e) => setDia(e.target.value)}
                      inputMode="decimal"
                      placeholder="例: 0.14"
                    />
                  ) : (
                    <select
                      style={styles.select}
                      value={dia}
                      onChange={(e) => {
                        setDia(e.target.value);
                        setCode("");
                      }}
                      disabled={!maker || !model}
                    >
                      <option value="">選択してください</option>
                      {diaOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={styles.field}>
                  <div style={styles.label}>保管場所（必須）</div>
                  <select
                    style={styles.select}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    <option value="">選択してください</option>
                    <option value="現場在庫">現場在庫</option>
                    <option value="倉庫在庫">倉庫在庫</option>
                  </select>
                </div>
              </div>

              {/* 前月数量（線径の下） */}
              {code.trim() && (
                <div style={styles.field}>
                  {previousLoading ? (
                    <div style={styles.previousDataLoading}>
                      前月データ取得中...
                    </div>
                  ) : previousQty !== null ? (
                    <div style={styles.previousDataBox}>
                      <strong>前月数量: {fmt2(previousQty)}</strong>
                    </div>
                  ) : (
                    <div
                      style={{
                        ...styles.previousDataBox,
                        borderColor: "#ccc",
                        background: "#f5f5f5",
                        color: "#666",
                      }}
                    >
                      前月データなし
                    </div>
                  )}
                </div>
              )}

              {/* 数量・本数 */}
              <div style={row2Style}>
                <div style={styles.field}>
                  <div style={styles.label}>数量（必須・小数第2位）</div>
                  <input
                    style={styles.input}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onBlur={() => setQty((v) => (v === "" ? "" : fmt2(v)))}
                    inputMode="decimal"
                    placeholder="例: 12.34"
                  />
                </div>

                <div style={styles.field}>
                  <div style={styles.label}>本数（任意）</div>
                  <input
                    style={styles.input}
                    value={hon}
                    onChange={(e) => setHon(e.target.value)}
                    inputMode="numeric"
                    placeholder="例: 25"
                  />
                </div>
              </div>

              {/* 備考 */}
              <div style={styles.field}>
                <div style={styles.label}>備考（任意）</div>
                <textarea
                  style={styles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例: ロットNo.、注意点など"
                />
              </div>

              {/* 送信 */}
              <button
                type="submit"
                disabled={sending}
                style={{
                  ...styles.btn,
                  ...(sending ? styles.btnDisabled : null),
                }}
              >
                {sending ? "送信中..." : "送信"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                ※ 本数・備考以外は必須。送信中は二重送信を防止します。
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
