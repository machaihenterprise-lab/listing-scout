"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

type Note = {
  id: string;
  body: string;
  created_at: string;
  message_type: string | null;
  sender_type: string | null;
};

type LeadNotesProps = {
  leadId: string;
};

// Client-side Supabase (anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export function LeadNotes({ leadId }: LeadNotesProps) {
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  // ---- Load existing notes for this lead ----
  const loadNotes = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", leadId)
        .eq("message_type", "NOTE")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading notes:", error);
        setError(error.message);
        return;
      }

      setNotes((data as Note[]) ?? []);
    } catch (err) {
      console.error("Unexpected error loading notes", err);
      setError("Unexpected error loading notes");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadNotes();
  }, [leadId, loadNotes]);

  // ---- Save a new note ----
  async function handleSaveNote() {
    if (!leadId) return;
    if (!noteText.trim()) return;

    setError(null);

    try {
      const insertPayload = {
     lead_id: leadId,
     body: noteText,
     message_type: "NOTE",
     is_private: true,
     sender_type: "agent",
     // Use valid values that pass your DB checks
     channel: "SMS",       // <-- matches existing rows & channel check
     direction: "OUTBOUND", // <-- likely allowed; same as agent-sent SMS
     is_auto: false,
     };


      const { data, error } = await supabase
        .from("messages")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) {
        console.error("Error saving note:", error);
        setError(error.message);
        return;
      }

      if (data) {
        setNotes((prev) => [...prev, data as Note]);
      }
      setNoteText("");
    } catch (err) {
      console.error("Unexpected error saving note", err);
      setError("Unexpected error saving note");
    }
  }

  async function handleDeleteNote(id: string) {
    setError(null);
    try {
      const { error: delError } = await supabase
        .from("messages")
        .delete()
        .eq("id", id)
        .eq("lead_id", leadId)
        .eq("message_type", "NOTE");

      if (delError) {
        console.error("Error deleting note:", delError);
        setError(delError.message);
        return;
      }

      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditText("");
      }
    } catch (err) {
      console.error("Unexpected error deleting note", err);
      setError("Unexpected error deleting note");
    }
  }

  async function handleUpdateNote(id: string) {
    if (!editText.trim()) return;
    setError(null);
    try {
      const { data, error: updError } = await supabase
        .from("messages")
        .update({ body: editText })
        .eq("id", id)
        .eq("lead_id", leadId)
        .eq("message_type", "NOTE")
        .select("*")
        .single();

      if (updError) {
        console.error("Error updating note:", updError);
        setError(updError.message);
        return;
      }

      if (data) {
        setNotes((prev) => prev.map((n) => (n.id === id ? (data as Note) : n)));
      }
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Unexpected error updating note", err);
      setError("Unexpected error updating note");
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="border rounded-lg p-3 bg-slate-900/60">
        <div className="text-sm font-semibold mb-1">
          Private notes for this lead
        </div>
        <div className="text-xs text-slate-400 mb-2">
          These notes are only visible to your team.
        </div>

        <textarea
          className="w-full min-h-[80px] rounded border bg-slate-950/60 px-2 py-1 text-sm"
          placeholder="Type a private note (only your team can see this)"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1 rounded border text-sm"
            onClick={() => setNoteText("")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded bg-emerald-500 text-black text-sm"
            onClick={handleSaveNote}
          >
            Save note
          </button>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-400">
            Error: {error}
          </div>
        )}
      </div>

      <div className="flex-1 border rounded-lg p-3 bg-slate-900/60 overflow-y-auto">
        <div className="text-sm font-semibold mb-2">Notes history</div>
        {loading && (
          <div className="text-xs text-slate-400">Loading…</div>
        )}
        {!loading && notes.length === 0 && !error && (
          <div className="text-xs text-slate-500">No private notes yet.</div>
        )}

        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border border-yellow-400/40 bg-yellow-400/5 rounded-md px-3 py-2 text-xs"
            >
              <div className="mb-1 font-semibold flex items-center gap-2">
                <span>🔒 PRIVATE NOTE</span>
                <span className="text-[10px] text-slate-400">
                  {new Date(note.created_at).toLocaleString()}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {editingId === note.id ? (
                    <>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded bg-emerald-500 text-black"
                        onClick={() => handleUpdateNote(note.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-slate-500"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-slate-500"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditText(note.body);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-rose-500 text-rose-200"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editingId === note.id ? (
                <textarea
                  className="w-full min-h-[70px] rounded border bg-slate-950/60 px-2 py-1 text-sm"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              ) : (
                <div>{note.body}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
