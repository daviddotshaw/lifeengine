import React from "react";
import { MENTORS } from "../mentors.js";
import { FLAVORS } from "../flavors/index.js";
import { pushConfigured } from "../push.js";

export default function SettingsView({
  flavorId,
  setFlavorId,
  mentorId,
  setMentorId,
  reminder,
  setReminder,
  toggleReminder,
  notifDenied,
  pushEnabled,
  togglePush,
  pushNote,
  defaultsNote,
  addDefaults,
  pendingImport,
  setPendingImport,
  exportData,
  handleImportFile,
  applyImport,
  importNote,
  importFileRef,
  apiKey,
  keyDraft,
  setKeyDraft,
  saveKey,
  keySaved,
  setApiKey,
}) {
  return (
    <>
      <div className="le-settings-section">
        <h2 className="le-h2" style={{ marginBottom: 4 }}>
          Style
        </h2>
        <p className="le-sub">Changes the look and the reward system on this device.</p>
        {Object.values(FLAVORS).map((f) => (
          <button
            key={f.id}
            className={`le-mentor ${f.id === flavorId ? "on" : ""}`}
            onClick={() => setFlavorId(f.id)}
          >
            <span className="le-glyph">{f.glyph}</span>
            <span className="le-mentor-text">
              <span className="le-card-title">{f.name}</span>
              <span className="le-card-meta">{f.tagline}</span>
            </span>
            {f.id === flavorId && <span className="le-mentor-on">Active</span>}
          </button>
        ))}
      </div>

      <div className="le-settings-section">
        <h2 className="le-h2" style={{ marginBottom: 4 }}>
          Mentor
        </h2>
        <p className="le-sub">Sets the voice of your daily transmission.</p>
        <button
          className={`le-mentor ${mentorId === "none" ? "on" : ""}`}
          onClick={() => setMentorId("none")}
        >
          <span className="le-glyph">🔇</span>
          <span className="le-mentor-text">
            <span className="le-card-title">No mentor</span>
            <span className="le-card-meta">Silence. Just you and the deck.</span>
          </span>
          {mentorId === "none" && <span className="le-mentor-on">Active</span>}
        </button>
        {Object.values(MENTORS).map((m) => (
          <button
            key={m.id}
            className={`le-mentor ${m.id === mentorId ? "on" : ""}`}
            onClick={() => setMentorId(m.id)}
          >
            <span className="le-glyph">{m.glyph}</span>
            <span className="le-mentor-text">
              <span className="le-card-title">{m.name}</span>
              <span className="le-card-meta">{m.tagline}</span>
            </span>
            {m.id === mentorId && <span className="le-mentor-on">Active</span>}
          </button>
        ))}
      </div>

      <div className="le-settings-section">
        <h2 className="le-h2" style={{ marginBottom: 4 }}>
          Daily reminder
        </h2>
        <p className="le-sub">
          A nudge if nothing is completed by the set time. Works while the app is open —
          without a server, the phone can't be reached once the app is fully closed.
        </p>
        <div className="le-add">
          <div className="le-key-row">
            <button
              className={`le-btn ${reminder.enabled ? "moss" : ""}`}
              onClick={toggleReminder}
            >
              {reminder.enabled ? "Reminders on ✓" : "Enable reminders"}
            </button>
            <input
              className="le-input"
              type="time"
              style={{ width: "auto" }}
              value={reminder.time}
              onChange={(e) => setReminder((r) => ({ ...r, time: e.target.value || "18:00" }))}
            />
          </div>
          {notifDenied && (
            <p className="le-fineprint">
              Notifications are blocked for this site — allow them in your browser/site
              settings, then try again.
            </p>
          )}
          {pushConfigured() ? (
            <>
              <button className={`le-btn ${pushEnabled ? "moss" : ""}`} onClick={togglePush}>
                {pushEnabled ? "Background reminders on ✓" : "Enable background reminders"}
              </button>
              {pushNote && <p className="le-fineprint">{pushNote}</p>}
              <p className="le-fineprint">
                Background reminders arrive even with the app closed, at the time set
                above. On iPhone the app must be installed to the Home Screen. Completing
                any task cancels that day's reminder.
              </p>
            </>
          ) : (
            <p className="le-fineprint">
              Reminders are in-app only on this build. True background reminders need the
              companion push server — see server/README.md in the repo.
            </p>
          )}
        </div>
      </div>

      <div className="le-settings-section">
        <h2 className="le-h2" style={{ marginBottom: 4 }}>
          Starter tasks
        </h2>
        <p className="le-sub">
          Adds the default task set (grouped: health, mindfulness, chores, learning,
          connection) — skips any already in your deck.
        </p>
        <div className="le-key-row">
          <button className="le-btn" onClick={addDefaults}>
            Add default tasks
          </button>
          {defaultsNote && (
            <p className="le-fineprint" style={{ alignSelf: "center" }}>
              {defaultsNote}
            </p>
          )}
        </div>
      </div>

      <div className="le-settings-section">
        <h2 className="le-h2" style={{ marginBottom: 4 }}>
          Your data
        </h2>
        <p className="le-sub">
          Everything lives only on this device. Export a backup before switching phones or
          clearing the browser — it restores tasks, history, XP, streak freezes and the
          whole collection.
        </p>
        <div className="le-add">
          <div className="le-key-row">
            <button className="le-btn" onClick={exportData}>
              Export backup
            </button>
            <button className="le-btn" onClick={() => importFileRef.current?.click()}>
              Import backup…
            </button>
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
          {pendingImport && (
            <>
              <p className="le-fineprint">
                Backup
                {pendingImport.exportedAt
                  ? ` from ${new Date(pendingImport.exportedAt).toLocaleString()}`
                  : ""}{" "}
                with {pendingImport.state.tasks.length} tasks,{" "}
                {pendingImport.state.log.length} completions and{" "}
                {(pendingImport.state.rewards || []).length} rewards. Importing replaces
                everything currently on this device.
              </p>
              <div className="le-key-row">
                <button className="le-btn danger" onClick={applyImport}>
                  Replace &amp; restore
                </button>
                <button className="le-btn" onClick={() => setPendingImport(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
          {importNote && <p className="le-fineprint">{importNote}</p>}
          <p className="le-fineprint">
            The backup file includes your API key if one is saved — keep it private.
          </p>
        </div>
      </div>

      <h2 className="le-h2" style={{ margin: "22px 0 4px" }}>
        AI connection
      </h2>
      <p className="le-sub">
        {apiKey
          ? "API key configured — transmissions and AI task ideas are live."
          : "No API key set — mentors use their built-in offline lines and task suggestions come from the offline list. Add an Anthropic API key for live AI generation."}
      </p>
      <div className="le-add">
        <input
          className="le-input"
          type="password"
          placeholder={apiKey ? "Replace saved key…" : "sk-ant-…"}
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          autoComplete="off"
        />
        <div className="le-key-row">
          <button className="le-btn" onClick={saveKey} disabled={!keyDraft.trim()}>
            {keySaved ? "Saved ✓" : "Save key"}
          </button>
          {apiKey && (
            <button
              className="le-btn danger"
              onClick={() => {
                setApiKey("");
                setKeyDraft("");
              }}
            >
              Remove key
            </button>
          )}
        </div>
        <p className="le-fineprint">
          Stored only in this device's IndexedDB and sent only to api.anthropic.com.
          Single-user use only — never embed a key in a shared deployment.
        </p>
      </div>
    </>
  );
}
