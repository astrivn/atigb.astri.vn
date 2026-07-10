// Supabase client (dùng chung). Import supabase-js từ CDN (ESM).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const C = window.ATIGB_CONFIG;
export const sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
  db: { schema: C.SCHEMA },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "atigb-auth" }
});

// tiện ích toast
export function toast(msg, isErr = false) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle("err", isErr);
  t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 3200);
}

export const DIM_ORDER = ["C", "I", "O", "OC", "IM"];
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric" }) : "";
