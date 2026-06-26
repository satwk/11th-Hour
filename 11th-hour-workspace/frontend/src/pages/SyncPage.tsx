import React, { useState, useEffect } from 'react';
import { useApp, BACKEND_URL, TEST_USER } from '../context/AppContext';
import { Calendar, RefreshCw, Key, Check, AlertCircle } from 'lucide-react';

export const SyncPage: React.FC = () => {
  const { 
    tasks, 
    fetchTasks, 
    googleConnected, 
    saveGoogleToken, 
    loading 
  } = useApp();

  const [clientId, setClientId] = useState<string>(
    localStorage.getItem('11h_google_client_id') || ''
  );
  const [manualToken, setManualToken] = useState<string>('');
  const [freeBusySlots, setFreeBusySlots] = useState<any[]>([]);
  const [fbLoading, setFbLoading] = useState<boolean>(false);
  const [fbError, setFbError] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [scheduleResult, setScheduleResult] = useState<any | null>(null);
  const [scheduling, setScheduling] = useState<boolean>(false);

  // Check URL hash for OAuth redirect token
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        // Clear hash from URL for cleaner look
        window.history.replaceState(null, '', window.location.pathname);
        saveGoogleToken(token);
      }
    }
  }, []);

  const handleSaveClientId = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setClientId(id);
    localStorage.setItem('11h_google_client_id', id);
  };

  const handleGoogleLogin = () => {
    if (!clientId.trim()) {
      alert('Please enter a valid Google OAuth Client ID first. Retrieve one from your Google Cloud Console.');
      return;
    }
    const redirectUri = window.location.origin + '/sync';
    const scopes = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}&include_granted_scopes=true&state=auth_sync`;
    
    // Redirect to Google Consent screen
    window.location.href = authUrl;
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await saveGoogleToken(manualToken.trim());
    setManualToken('');
  };

  const handleFetchFreeBusy = async () => {
    try {
      setFbLoading(true);
      setFbError(null);
      const res = await fetch(`${BACKEND_URL}/calendar/free-busy?firebaseId=${TEST_USER.firebaseId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch free/busy data.');
      }
      const data = await res.json();
      setFreeBusySlots(data.freeBusy?.busy || []);
    } catch (err: any) {
      console.error(err);
      setFbError(err.message || 'Failed to query calendar free/busy slots.');
    } finally {
      setFbLoading(false);
    }
  };

  const handleScheduleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    try {
      setScheduling(true);
      setScheduleResult(null);

      const res = await fetch(`${BACKEND_URL}/calendar/schedule-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseId: TEST_USER.firebaseId,
          taskId: selectedTaskId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to auto-schedule task.');
      }

      const data = await res.json();
      setScheduleResult(data);
      setSelectedTaskId('');
      await fetchTasks(); // reload tasks to update list
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Auto-scheduling failed.');
    } finally {
      setScheduling(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Find tasks that aren't completed or already in progress
  const schedulableTasks = tasks.filter(t => t.status === 'Not Started');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-[#222326] pb-5">
        <h1 className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">Calendar Integration</h1>
        <p className="text-xs text-[#8a8f98] mt-0.5">Bi-directional synchronization and auto-slot scheduling configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: OAuth Connection Details */}
        <div className="space-y-6">
          <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md space-y-4">
            <h2 className="text-base font-semibold text-[#f7f8f8] tracking-tight flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-[#5e6ad2]" />
              <span>Google Calendar Authentication</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#d0d6e0] mb-1.5 uppercase font-mono">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={handleSaveClientId}
                  placeholder="e.g. 123456-abcdef.apps.googleusercontent.com"
                  className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-2.5 text-xs font-mono focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] transition-all"
                />
                <span className="text-[10px] text-[#62666d] mt-1 block">
                  Add <code className="bg-[#141516] px-1 py-0.5 rounded font-mono border border-[#222326]">{window.location.origin}/sync</code> to your Authorized redirect URIs in Google Console.
                </span>
              </div>

              {googleConnected ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-md text-xs">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Authorized access connected to primary Google Calendar successfully!</span>
                  </div>
                  <button
                    onClick={() => saveGoogleToken(null)}
                    disabled={loading}
                    className="w-full bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/20 font-medium text-xs py-2 px-4 rounded-md transition-colors cursor-pointer"
                  >
                    Disconnect Google Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-xs py-2.5 px-4 rounded-md transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Connect Google Calendar</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dev Manual Paste Box */}
          <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md space-y-4">
            <h2 className="text-sm font-semibold text-[#f7f8f8] tracking-tight flex items-center space-x-2 font-mono">
              <Key className="w-4 h-4 text-[#8a8f98]" />
              <span>Developer Manual Connection Token</span>
            </h2>
            <p className="text-xs text-[#8a8f98] leading-relaxed">
              Skip Client ID configurations entirely by grabbing an access token from Google OAuth Playground and pasting it directly:
            </p>

            <form onSubmit={handleManualTokenSubmit} className="space-y-3">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste Access Token (starts with ya29...)"
                className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-2.5 text-xs font-mono focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] transition-all"
              />
              <button
                type="submit"
                disabled={loading || !manualToken.trim()}
                className="w-full bg-[#141516] hover:bg-[#18191a] text-[#d0d6e0] border border-[#222326] font-medium text-xs py-2 px-4 rounded-md transition-colors cursor-pointer disabled:opacity-40"
              >
                Connect Manual Token
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Free Busy Viewer & Auto Scheduling Engine */}
        <div className="space-y-6">
          {/* Scheduling Tester */}
          <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md space-y-4">
            <h2 className="text-base font-semibold text-[#f7f8f8] tracking-tight">Auto-Scheduling Engine</h2>
            <p className="text-xs text-[#8a8f98]">
              Pick an unscheduled task. The engine parses existing events and finds the first waking hour slot (8 AM - 8 PM) to schedule.
            </p>

            <form onSubmit={handleScheduleTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#d0d6e0] mb-1.5 uppercase font-mono">
                  Select Unscheduled Task
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full bg-[#141516] text-[#f7f8f8] border border-[#222326] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#34343a] focus:ring-1 focus:ring-[#5e6ad2] transition-all"
                  disabled={!googleConnected || scheduling}
                >
                  <option value="">-- Choose Task --</option>
                  {schedulableTasks.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.estimatedDuration}m · {t.cognitiveLoad} load)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!googleConnected || !selectedTaskId || scheduling}
                className="w-full bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium text-xs py-2.5 px-4 rounded-md transition-colors shadow-sm disabled:bg-[#141516] disabled:text-[#62666d] disabled:cursor-not-allowed cursor-pointer"
              >
                {scheduling ? 'Finding Slot & Booking...' : 'Schedule in First Available Slot'}
              </button>
            </form>

            {scheduleResult && (
              <div className="border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-md space-y-2 animate-fade-in">
                <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>Successfully Booked!</span>
                </div>
                <div className="text-xs text-[#8a8f98] space-y-1">
                  <p><strong>Title:</strong> {scheduleResult.event?.summary}</p>
                  <p><strong>Start:</strong> {formatDateTime(scheduleResult.slot?.start)}</p>
                  <p><strong>End:</strong> {formatDateTime(scheduleResult.slot?.end)}</p>
                  {scheduleResult.event?.htmlLink && (
                    <a
                      href={scheduleResult.event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5e6ad2] hover:underline block pt-1.5"
                    >
                      View on Google Calendar
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Busy Slots Viewer */}
          <div className="bg-[#0f1011] border border-[#222326] rounded-lg p-6 shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-[#f7f8f8] tracking-tight">Primary Calendar Busy Slots</h2>
              <button
                onClick={handleFetchFreeBusy}
                disabled={!googleConnected || fbLoading}
                className="p-1.5 rounded bg-[#141516] hover:bg-[#18191a] border border-[#222326] text-[#8a8f98] hover:text-[#f7f8f8] transition-all disabled:opacity-40 cursor-pointer"
                title="Refresh Calendar Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fbLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {fbError && (
              <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/5 border border-rose-500/10 p-3 rounded-md text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{fbError}</span>
              </div>
            )}

            {!googleConnected ? (
              <p className="text-xs text-[#62666d] italic text-center py-4">
                Connect your account to fetch your free/busy schedules.
              </p>
            ) : fbLoading ? (
              <p className="text-xs text-[#8a8f98] text-center py-4">Querying Google Calendar freebusy lists...</p>
            ) : freeBusySlots.length === 0 ? (
              <p className="text-xs text-[#8a8f98] text-center py-4 italic">
                No busy events detected in the next 3 days. Your schedule is clear!
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {freeBusySlots.map((slot, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between items-center text-[11px] p-2 bg-[#141516] border border-[#222326] rounded-md font-mono"
                  >
                    <span className="text-[#8a8f98]">Busy Slot {index + 1}:</span>
                    <span className="text-[#f7f8f8]">
                      {formatDateTime(slot.start)} - {formatDateTime(slot.end)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
