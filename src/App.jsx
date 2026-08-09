import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  Receipt,
  LayoutDashboard,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Phone,
  Sparkles,
  Wallet,
  TrendingUp,
  TrendingDown,
  Fuel,
  Megaphone,
  ShieldCheck,
  Package,
  Check,
  WifiOff,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  StickyNote,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "./supabaseClient";

// ---------- Static config ----------

const SERVICE_OPTIONS = [
  "Standard Cleaning",
  "Deep Clean",
  "Weekly",
  "Bi-Weekly",
  "Monthly",
  "Move-Out",
  "Move-In",
  "Post-Construction",
];

const EXPENSE_CATEGORIES = [
  { name: "Supplies", icon: Package, color: "#1e3a8a" },
  { name: "Fuel", icon: Fuel, color: "#f59e0b" },
  { name: "Marketing", icon: Megaphone, color: "#3b82f6" },
  { name: "Insurance", icon: ShieldCheck, color: "#b45309" },
];

const categoryMeta = (name) =>
  EXPENSE_CATEGORIES.find((c) => c.name === name) || EXPENSE_CATEGORIES[0];

const currency = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const emptyClientForm = { name: "", phone: "", service: SERVICE_OPTIONS[0], price: "" };
const emptyExpenseForm = { description: "", category: EXPENSE_CATEGORIES[0].name, cost: "" };
const emptyEventForm = { title: "", event_date: "", event_time: "", notes: "" };

// ---------- Date helpers (for the calendar grid) ----------

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Builds a full 6-row x 7-col grid of dates for the given month,
// including the trailing/leading days from adjacent months.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// ---------- Small building blocks ----------

function SectionCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        active
          ? "bg-white text-blue-950 shadow-sm"
          : "text-white/85 hover:bg-white/10"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow";

// ---------- Main component ----------

// ---------- Main component ----------

export default function App() {
  const [tab, setTab] = useState("dashboard");

  const [clients, setClients] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [syncNote, setSyncNote] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const loadAll = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const [clientsRes, expensesRes, scheduleRes] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: true }),
        supabase.from("expenses").select("*").order("created_at", { ascending: true }),
        supabase
          .from("schedule_events")
          .select("*")
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      setClients(clientsRes.data || []);
      setExpenses(expensesRes.data || []);
      setScheduleEvents(scheduleRes.data || []);
      setSyncStatus("synced");
      setSyncNote("");
    } catch (err) {
      setSyncStatus("error");
      setSyncNote(err?.message || "Couldn't reach the shared database.");
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Initial load + realtime subscriptions so every teammate's device
  // stays in sync automatically when anyone adds/edits/deletes.
  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("horizon-live-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_events" }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientError, setClientError] = useState("");

  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseError, setExpenseError] = useState("");

  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventError, setEventError] = useState("");

  // ---------- Derived data ----------

  const totalIncome = useMemo(
    () => clients.reduce((sum, c) => sum + Number(c.price || 0), 0),
    [clients]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.cost || 0), 0),
    [expenses]
  );
  const netProfit = totalIncome - totalExpenses;

  const expenseBreakdown = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => ({
      name: cat.name,
      value: expenses
        .filter((e) => e.category === cat.name)
        .reduce((sum, e) => sum + Number(e.cost || 0), 0),
      color: cat.color,
    })).filter((c) => c.value > 0);
  }, [expenses]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  // ---------- Client handlers ----------

  function resetClientForm() {
    setClientForm(emptyClientForm);
    setEditingClientId(null);
    setClientError("");
  }

  async function handleClientSubmit(e) {
    e.preventDefault();
    const name = clientForm.name.trim();
    const phone = clientForm.phone.trim();
    const price = Number(clientForm.price);

    if (!name || !phone) {
      setClientError("Name and phone number are required.");
      return;
    }
    if (!clientForm.price || isNaN(price) || price < 0) {
      setClientError("Enter a valid agreed price.");
      return;
    }

    try {
      if (editingClientId) {
        const { error } = await supabase
          .from("clients")
          .update({ name, phone, service: clientForm.service, price })
          .eq("id", editingClientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert({ name, phone, service: clientForm.service, price });
        if (error) throw error;
      }
      resetClientForm();
      loadAll();
    } catch (err) {
      setClientError(err?.message || "Couldn't save this client. Try again.");
    }
  }

  function startEditClient(client) {
    setEditingClientId(client.id);
    setClientForm({
      name: client.name,
      phone: client.phone,
      service: client.service,
      price: String(client.price),
    });
    setClientError("");
    setTab("clients");
  }

  async function deleteClient(id) {
    if (editingClientId === id) resetClientForm();
    setClients((prev) => prev.filter((c) => c.id !== id)); // optimistic
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      setClientError(error?.message || "Couldn't delete this client.");
      loadAll(); // revert to server truth
    }
  }

  // ---------- Expense handlers ----------

  function resetExpenseForm() {
    setExpenseForm(emptyExpenseForm);
    setEditingExpenseId(null);
    setExpenseError("");
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    const description = expenseForm.description.trim();
    const cost = Number(expenseForm.cost);

    if (!description) {
      setExpenseError("Enter a description for this expense.");
      return;
    }
    if (!expenseForm.cost || isNaN(cost) || cost < 0) {
      setExpenseError("Enter a valid cost.");
      return;
    }

    try {
      if (editingExpenseId) {
        const { error } = await supabase
          .from("expenses")
          .update({ description, category: expenseForm.category, cost })
          .eq("id", editingExpenseId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert({ description, category: expenseForm.category, cost });
        if (error) throw error;
      }
      resetExpenseForm();
      loadAll();
    } catch (err) {
      setExpenseError(err?.message || "Couldn't save this expense. Try again.");
    }
  }

  function startEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description,
      category: expense.category,
      cost: String(expense.cost),
    });
    setExpenseError("");
    setTab("expenses");
  }

  async function deleteExpense(id) {
    if (editingExpenseId === id) resetExpenseForm();
    setExpenses((prev) => prev.filter((ex) => ex.id !== id)); // optimistic
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      loadAll(); // revert to server truth
    }
  }

  // ---------- Schedule handlers ----------

  function resetEventForm(prefillDate) {
    setEventForm({ ...emptyEventForm, event_date: prefillDate || "" });
    setEditingEventId(null);
    setEventError("");
  }

  function pickDayForNewEvent(dateKey) {
    setEditingEventId(null);
    setEventForm({ ...emptyEventForm, event_date: dateKey });
    setEventError("");
  }

  async function handleEventSubmit(e) {
    e.preventDefault();
    const title = eventForm.title.trim();
    const notes = eventForm.notes.trim();

    if (!title) {
      setEventError("Give this job a title.");
      return;
    }
    if (!eventForm.event_date) {
      setEventError("Pick a date on the calendar or in the date field.");
      return;
    }

    try {
      const payload = {
        title,
        event_date: eventForm.event_date,
        event_time: eventForm.event_time || null,
        notes: notes || null,
      };
      if (editingEventId) {
        const { error } = await supabase
          .from("schedule_events")
          .update(payload)
          .eq("id", editingEventId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedule_events").insert(payload);
        if (error) throw error;
      }
      resetEventForm();
      loadAll();
    } catch (err) {
      setEventError(err?.message || "Couldn't save this job. Try again.");
    }
  }

  function startEditEvent(event) {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time || "",
      notes: event.notes || "",
    });
    setEventError("");
  }

  async function deleteEvent(id) {
    if (editingEventId === id) resetEventForm();
    setScheduleEvents((prev) => prev.filter((ev) => ev.id !== id)); // optimistic
    const { error } = await supabase.from("schedule_events").delete().eq("id", id);
    if (error) {
      loadAll(); // revert to server truth
    }
  }

  // ---------- Render ----------

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-blue-900">
          <Sparkles className="animate-pulse" size={28} />
          <p className="text-sm font-semibold text-slate-500">
            Connecting to your team's data…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800">
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="sweep"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line x1="0" y1="0" x2="0" y2="40" stroke="white" strokeWidth="10" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sweep)" />
        </svg>
        <div className="relative max-w-6xl mx-auto px-6 py-7 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
              <Sparkles className="text-amber-300" size={22} />
            </div>
            <div>
              <h1
                className="text-white text-xl sm:text-2xl font-bold tracking-tight leading-tight"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Horizon State Cleaning
              </h1>
              <p className="text-amber-200/90 text-xs sm:text-sm font-medium">
                Client &amp; finance management
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-2xl p-1.5 ring-1 ring-white/20">
            <TabButton
              active={tab === "dashboard"}
              onClick={() => setTab("dashboard")}
              icon={LayoutDashboard}
              label="Dashboard"
            />
            <TabButton
              active={tab === "clients"}
              onClick={() => setTab("clients")}
              icon={Users}
              label="Clients"
            />
            <TabButton
              active={tab === "calendar"}
              onClick={() => setTab("calendar")}
              icon={CalendarDays}
              label="Calendar"
            />
            <TabButton
              active={tab === "expenses"}
              onClick={() => setTab("expenses")}
              icon={Receipt}
              label="Expenses"
            />
          </nav>
          <img
            src="/logo.png"
            alt="Horizon State Cleaning logo"
            className="h-12 sm:h-14 w-auto object-contain drop-shadow-md"
          />
        </div>
      </header>

      {(!isOnline || syncStatus === "error") && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-amber-800">
          <WifiOff size={14} />
          {!isOnline
            ? "You're offline — showing the last synced data. Changes will sync once you're back online."
            : `Sync issue: ${syncNote}`}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === "dashboard" && (
          <DashboardTab
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netProfit={netProfit}
            expenseBreakdown={expenseBreakdown}
            clientCount={clients.length}
          />
        )}

        {tab === "clients" && (
          <ClientsTab
            clients={filteredClients}
            allCount={clients.length}
            search={clientSearch}
            setSearch={setClientSearch}
            form={clientForm}
            setForm={setClientForm}
            error={clientError}
            editingId={editingClientId}
            onSubmit={handleClientSubmit}
            onCancel={resetClientForm}
            onEdit={startEditClient}
            onDelete={deleteClient}
          />
        )}

        {tab === "calendar" && (
          <CalendarTab
            events={scheduleEvents}
            form={eventForm}
            setForm={setEventForm}
            error={eventError}
            editingId={editingEventId}
            onSubmit={handleEventSubmit}
            onCancel={() => resetEventForm()}
            onEdit={startEditEvent}
            onDelete={deleteEvent}
            onPickDay={pickDayForNewEvent}
          />
        )}

        {tab === "expenses" && (
          <ExpensesTab
            expenses={expenses}
            form={expenseForm}
            setForm={setExpenseForm}
            error={expenseError}
            editingId={editingExpenseId}
            onSubmit={handleExpenseSubmit}
            onCancel={resetExpenseForm}
            onEdit={startEditExpense}
            onDelete={deleteExpense}
          />
        )}
      </main>
    </div>
  );
}

function DashboardTab({
  totalIncome,
  totalExpenses,
  netProfit,
  expenseBreakdown,
  clientCount,
}) {
  const hasExpenses = expenseBreakdown.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-lg font-bold text-slate-800"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          This month at a glance
        </h2>
        <p className="text-sm text-slate-500">
          Based on {clientCount} active client{clientCount === 1 ? "" : "s"} and
          all logged expenses.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard className="p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Total Monthly Income
            </p>
            <p
              className="text-2xl font-extrabold tracking-tight text-slate-800"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {currency(totalIncome)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 text-blue-900">
            <TrendingUp size={20} />
          </div>
        </SectionCard>

        <SectionCard className="p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Total Monthly Expenses
            </p>
            <p
              className="text-2xl font-extrabold tracking-tight text-slate-800"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {currency(totalExpenses)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
            <TrendingDown size={20} />
          </div>
        </SectionCard>

        <SectionCard className="p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Net Profit
            </p>
            <p
              className={`text-2xl font-extrabold tracking-tight ${
                netProfit < 0 ? "text-rose-600" : "text-amber-600"
              }`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {currency(netProfit)}
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              netProfit < 0
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <Wallet size={20} />
          </div>
        </SectionCard>
      </div>

      <SectionCard className="p-6">
        <h3
          className="text-base font-bold text-slate-800 mb-1"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Expense breakdown by category
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Where the month's spending is going.
        </p>

        {!hasExpenses ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            No expenses logged yet — add one from the Expenses tab.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {expenseBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {expenseBreakdown.map((entry) => {
                const pct = totalExpenses
                  ? Math.round((entry.value / totalExpenses) * 100)
                  : 0;
                const meta = categoryMeta(entry.name);
                const Icon = meta.icon;
                return (
                  <div key={entry.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Icon size={15} style={{ color: entry.color }} />
                        {entry.name}
                      </div>
                      <span className="text-sm font-semibold text-slate-600">
                        {currency(entry.value)}{" "}
                        <span className="text-slate-400 font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: entry.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---------- Clients ----------

function ClientsTab({
  clients,
  allCount,
  search,
  setSearch,
  form,
  setForm,
  error,
  editingId,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SectionCard className="p-6 lg:col-span-1 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-bold text-slate-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {editingId ? "Edit client" : "Add a client"}
          </h3>
          {editingId && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600"
              title="Cancel edit"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <input
              className={inputClass}
              placeholder="e.g. Marlene Ford"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Phone number">
            <input
              className={inputClass}
              placeholder="(520) 555-0123"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Service needed">
            <select
              className={inputClass}
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
            >
              {SERVICE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agreed pricing ($)">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="120.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Save changes" : "Add client"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard className="p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3
            className="text-base font-bold text-slate-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Clients ({allCount})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search name, phone, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">
            {allCount === 0
              ? "No clients yet — add your first one on the left."
              : "No clients match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Service</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-2 py-3 font-semibold text-slate-800">
                      {c.name}
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400" />
                        {c.phone}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="inline-block bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded-full">
                        {c.service}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-800">
                      {currency(Number(c.price))}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEdit(c)}
                          className="p-1.5 rounded-lg text-blue-900 hover:bg-blue-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ---------- Expenses ----------

function ExpensesTab({
  expenses,
  form,
  setForm,
  error,
  editingId,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
}) {
  const sorted = [...expenses].sort((a, b) =>
    a.category.localeCompare(b.category)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SectionCard className="p-6 lg:col-span-1 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-bold text-slate-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {editingId ? "Edit expense" : "Log an expense"}
          </h3>
          {editingId && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600"
              title="Cancel edit"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Description">
            <input
              className={inputClass}
              placeholder="e.g. Vacuum bags & sponges"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost ($)">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              placeholder="45.00"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </Field>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Save changes" : "Add expense"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard className="p-6 lg:col-span-2">
        <h3
          className="text-base font-bold text-slate-800 mb-4"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Logged expenses ({expenses.length})
        </h3>

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">
            No expenses logged yet — add your first one on the left.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((ex) => {
              const meta = categoryMeta(ex.category);
              const Icon = meta.icon;
              return (
                <li
                  key={ex.id}
                  className="flex items-center justify-between py-3 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {ex.description}
                      </p>
                      <p className="text-xs text-slate-500">{ex.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-slate-800">
                      {currency(Number(ex.cost))}
                    </span>
                    <button
                      onClick={() => onEdit(ex)}
                      className="p-1.5 rounded-lg text-blue-900 hover:bg-blue-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(ex.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ---------- Calendar ----------

function CalendarTab({
  events,
  form,
  setForm,
  error,
  editingId,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
  onPickDay,
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const todayKey = toDateKey(today);
  const monthDays = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    }
    return map;
  }, [events]);

  function goToMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SectionCard className="p-6 lg:col-span-1 h-fit lg:sticky lg:top-6">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-bold text-slate-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {editingId ? "Edit scheduled job" : "Schedule a job"}
          </h3>
          {(editingId || form.event_date) && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600"
              title="Cancel"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Title">
            <input
              className={inputClass}
              placeholder="e.g. Deep clean — Osei Family"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </Field>
            <Field label="Time (optional)">
              <input
                className={inputClass}
                type="time"
                value={form.event_time}
                onChange={(e) => setForm({ ...form, event_time: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea
              className={`${inputClass} min-h-[70px] resize-none`}
              placeholder="Address, access instructions, extras…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Save changes" : "Add to calendar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  onDelete(editingId);
                  onCancel();
                }}
                className="px-4 py-2.5 rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Tip: tap any day on the calendar to start scheduling that date.
          </p>
        </form>
      </SectionCard>

      <SectionCard className="p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-base font-bold text-slate-800"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {formatMonthLabel(viewYear, viewMonth)}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToMonth(-1)}
              className="p-2 rounded-lg text-blue-900 hover:bg-blue-50 transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-900 border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => goToMonth(1)}
              className="p-2 rounded-lg text-blue-900 hover:bg-blue-50 transition-colors"
              title="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-t-lg overflow-hidden text-center">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="bg-slate-50 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-b-lg overflow-hidden">
          {monthDays.map((d) => {
            const key = toDateKey(d);
            const isCurrentMonth = d.getMonth() === viewMonth;
            const isToday = key === todayKey;
            const dayEvents = eventsByDay[key] || [];

            return (
              <div
                key={key}
                onClick={() => onPickDay(key)}
                className={`bg-white min-h-[92px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-blue-50/60 ${
                  !isCurrentMonth ? "opacity-40" : ""
                } ${form.event_date === key && !editingId ? "ring-2 ring-inset ring-amber-400" : ""}`}
              >
                <span
                  className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-blue-900 text-white" : "text-slate-500"
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(ev);
                      }}
                      className="text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 transition-colors"
                      title={ev.title}
                    >
                      <p className="text-[10px] sm:text-[11px] font-semibold text-blue-950 truncate leading-tight">
                        {ev.event_time ? `${formatTimeLabel(ev.event_time)} · ` : ""}
                        {ev.title}
                      </p>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] font-semibold text-slate-400 px-1.5">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
