import React, { useEffect } from 'react';

export const LandingPage: React.FC = () => {
  // Inject Material Symbols stylesheet
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#010102] text-[#dee3ec] font-sans selection:bg-[#5e6ad2] selection:text-white">
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hairline { border: 1px solid #23252a; }
        .hairline-b { border-bottom: 1px solid #23252a; }
        .hairline-t { border-top: 1px solid #23252a; }
        .hairline-l { border-left: 1px solid #23252a; }
        .hairline-r { border-right: 1px solid #23252a; }
        
        .surface-1 { background-color: #0f1011; }
        .surface-2 { background-color: #141516; }
        .surface-3 { background-color: #18191a; }

        .btn-primary {
            background-color: #5e6ad2;
            color: #ffffff;
            transition: background-color 0.2s ease;
        }
        .btn-primary:hover { background-color: #828fff; }

        .btn-secondary {
            background-color: transparent;
            border: 1px solid #34343a;
            color: #ffffff;
            transition: all 0.2s ease;
        }
        .btn-secondary:hover { background-color: #0f1011; border-color: #5e6ad2; }

        .readiness-ring {
            stroke-dasharray: 226.19;
            stroke-dashoffset: 63.33; /* 72% shown */
            transition: stroke-dashoffset 1s ease-out;
        }
      ` }} />

      {/* Navbar */}
      <nav className="fixed top-0 w-full h-[56px] bg-[#010102]/80 backdrop-blur-md z-50 hairline-b">
        <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="text-lg font-bold text-[#dee3ec] tracking-tight">11th Hour</span>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://github.com/satwk" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary px-4 py-1.5 rounded-xl text-sm flex items-center gap-2 decoration-none"
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
              GitHub
            </a>
            <button 
              onClick={() => window.location.href = 'http://localhost:5000/api/auth/google'}
              className="btn-primary px-4 py-1.5 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-[56px]">
        {/* Hero Section */}
        <section className="max-w-[1280px] mx-auto px-6 py-12 lg:py-[120px]">
          <div className="flex flex-col items-center text-center mb-12">
            <span className="text-xs font-semibold text-[#5e6ad2] uppercase mb-4 tracking-[0.4px]">
              11TH HOUR — THE LAST-MINUTE LIFE SAVER
            </span>
            <h1 className="text-4xl lg:text-7xl font-bold max-w-4xl mb-4 leading-tight">
              Your task list doesn't know how tired you are. <span className="text-[#c6c5d5]">This one does.</span>
            </h1>
            <p className="text-lg text-[#c6c5d5] max-w-4xl mb-8">
              11th Hour reads your sleep, energy, and yesterday's wins to calculate real readiness — then re-orders your day around what you can actually finish, not what you hoped to.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => window.location.href = 'http://localhost:5000/api/auth/google'}
                className="btn-primary px-8 py-3 rounded-xl text-base font-bold text-center cursor-pointer"
              >
                Get Started Free
              </button>
            </div>
          </div>

          {/* Hero Visual Slot 1 */}
          <div className="surface-1 hairline rounded-xl overflow-hidden p-6 lg:p-12 flex flex-col lg:flex-row gap-12 items-center">
            {/* Eisenhower Matrix */}
            <div className="w-full lg:w-3/5 grid grid-cols-2 gap-1 aspect-square lg:aspect-auto h-[400px]">
              <div className="surface-2 hairline p-4 flex flex-col justify-between group">
                <span className="text-[10px] font-bold text-[#5e6ad2] uppercase tracking-widest">Urgent / Important</span>
                <div className="space-y-2 opacity-60">
                  <div className="h-2 w-3/4 bg-[#c6c5d5]/20 rounded"></div>
                  <div className="h-2 w-1/2 bg-[#c6c5d5]/20 rounded"></div>
                </div>
                <div className="material-symbols-outlined text-[#5e6ad2] text-4xl">bolt</div>
              </div>
              <div className="surface-2 hairline p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-[#c6c5d5]/50 uppercase tracking-widest">Important / Not Urgent</span>
                <div className="space-y-2 opacity-30">
                  <div className="h-2 w-4/5 bg-[#c6c5d5]/10 rounded"></div>
                </div>
                <div className="material-symbols-outlined text-[#c6c5d5]/20 text-4xl">calendar_today</div>
              </div>
              <div className="surface-2 hairline p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-[#c6c5d5]/50 uppercase tracking-widest">Urgent / Not Important</span>
                <div className="material-symbols-outlined text-[#c6c5d5]/20 text-4xl">person_add</div>
              </div>
              <div className="surface-2 hairline p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-[#c6c5d5]/50 uppercase tracking-widest">Neither</span>
                <div className="material-symbols-outlined text-[#c6c5d5]/20 text-4xl">delete</div>
              </div>
            </div>

            {/* Readiness Ring */}
            <div className="w-full lg:w-2/5 flex flex-col items-center justify-center space-y-6">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" fill="transparent" r="72" stroke="#23252a" strokeWidth="8"></circle>
                  <circle 
                    className="readiness-ring" 
                    cx="80" 
                    cy="80" 
                    fill="transparent" 
                    r="72" 
                    stroke="#5e6ad2" 
                    strokeLinecap="round" 
                    strokeWidth="8" 
                    style={{ strokeDasharray: '452.39', strokeDashoffset: '126.67' }}
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-white">72</span>
                  <span className="text-[10px] uppercase tracking-widest text-[#c6c5d5]/60">Readiness</span>
                </div>
              </div>
              <div className="text-center">
                <h4 className="font-bold text-[#dee3ec] mb-1">Balanced & Alert</h4>
                <p className="text-sm text-[#c6c5d5]">Prioritizing deep work before 2PM slump.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 1: Voice */}
        <section className="max-w-[1280px] mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold text-[#5e6ad2] uppercase mb-4 block">NATIVE BRAINDUMP</span>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">
              Speak it. It becomes a task — correctly classified.
            </h2>
            <p className="text-lg text-[#c6c5d5]">
              Stop wrestling with input fields. Tap the mic, speak your chaotic thoughts, and our LLM agent parses priority, tags, and deadlines in real-time.
            </p>
          </div>
          <div className="surface-1 hairline rounded-xl p-6 min-h-[300px] flex flex-col justify-end relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'wght' 100" }}>mic</span>
            </div>
            <div className="space-y-2 relative z-10">
              <div className="surface-3 hairline p-4 rounded-lg flex items-center justify-between">
                <span className="text-sm text-[#dee3ec] italic">"Remind me to finish the slide deck before the board meeting tomorrow morning..."</span>
                <span className="material-symbols-outlined text-[#5e6ad2]">equalizer</span>
              </div>
              <div className="flex gap-2">
                <div className="surface-2 hairline px-2 py-1 rounded text-[10px] text-[#5e6ad2] uppercase font-bold">Priority: High</div>
                <div className="surface-2 hairline px-2 py-1 rounded text-[10px] text-[#c6c5d5] uppercase font-bold">Tag: Slides</div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 2: Matrix */}
        <section className="max-w-[1280px] mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 surface-1 hairline rounded-xl p-6 aspect-video flex items-center justify-center overflow-hidden">
            <div className="relative w-full max-w-sm">
              {/* Fake Matrix Background */}
              <div className="grid grid-cols-2 grid-rows-2 gap-1 opacity-20">
                <div className="h-32 border border-dashed border-[#c6c5d5] rounded-lg"></div>
                <div className="h-32 border border-dashed border-[#c6c5d5] rounded-lg"></div>
                <div className="h-32 border border-dashed border-[#c6c5d5] rounded-lg"></div>
                <div className="h-32 border border-dashed border-[#c6c5d5] rounded-lg"></div>
              </div>
              {/* The Floating Card */}
              <div className="absolute top-1/4 left-1/4 w-48 surface-3 hairline p-4 rounded-lg shadow-xl transform rotate-3 -translate-y-4 cursor-grabbing border-[#5e6ad2]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-[#5e6ad2]">drag_indicator</span>
                  <span className="text-[12px] font-bold">Update DB Schema</span>
                </div>
                <div className="h-1.5 w-full bg-[#30353d] rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-[#5e6ad2]"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-xs font-semibold text-[#5e6ad2] uppercase mb-4 block">INTELLIGENT SORTING</span>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">
              Drag a task. Watch the matrix tell the truth.
            </h2>
            <p className="text-lg text-[#c6c5d5]">
              Our dynamic Eisenhower matrix isn't just a label. When you move a task, 11th Hour recalculates your entire week's schedule to accommodate the shift in priority.
            </p>
          </div>
        </section>

        {/* Feature 3: Readiness */}
        <section className="max-w-[1280px] mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center py-12">
          <div>
            <span className="text-xs font-semibold text-[#5e6ad2] uppercase mb-4 block">DAILY CAPACITY</span>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">It does the math before you overcommit.</h2>
            <p className="text-lg text-[#c6c5d5]">
              11th Hour calculates your daily bandwidth based on your sleep quality, energy levels, and recent wins. If you're running low, we automatically suggest moving low-stakes tasks to tomorrow to protect your focus.
            </p>
          </div>
          <div className="surface-1 hairline rounded-xl p-8 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-4">
              <span className="text-sm font-bold">Daily Readiness</span>
              <span className="text-sm text-[#ffb4ab] font-bold">Limited Capacity</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="surface-2 hairline p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-[#dee3ec]">6.5h</div>
                <div className="text-[10px] text-[#c6c5d5] uppercase tracking-tighter">Sleep</div>
              </div>
              <div className="surface-2 hairline p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-[#dee3ec]">2/5</div>
                <div className="text-[10px] text-[#c6c5d5] uppercase tracking-tighter">Energy</div>
              </div>
              <div className="surface-2 hairline p-4 rounded-lg text-center border-[#5e6ad2]">
                <div className="text-xl font-bold text-[#5e6ad2]">3</div>
                <div className="text-[10px] text-[#5e6ad2] uppercase tracking-tighter">Daily Wins</div>
              </div>
            </div>
            <div className="surface-3 p-4 rounded-lg border-l-4 border-[#5e6ad2]">
              <p className="text-sm italic opacity-80">"Suggested: Pushed 3 administrative tasks to Thursday. Keeping only 1 high-focus item for today."</p>
            </div>
          </div>
        </section>

        {/* Feature 4: Calendar */}
        <section className="max-w-[1280px] mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 surface-1 hairline rounded-xl overflow-hidden flex flex-col">
            <div className="surface-2 p-4 hairline-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ffb4ab]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffb867]"></div>
                <div className="w-3 h-3 rounded-full bg-[#5e6ad2]"></div>
              </div>
              <span className="text-[10px] font-mono text-[#c6c5d5]">google_calendar_v3_sync.log</span>
            </div>
            <div className="p-6 font-mono text-xs text-[#c6c5d5] space-y-1">
              <div className="text-[#5e6ad2]">[SUCCESS] OAuth Handshake complete</div>
              <div className="text-[#dee3ec]">[INFO] 4 conflicting meetings detected</div>
              <div className="text-[#5e6ad2]">[AUTO] 11th Hour blocking "Deep Work" slot 9-11 AM</div>
              <div className="text-[#dee3ec]">[INFO] Recalculating task stack...</div>
              <div className="animate-pulse text-[#dee3ec]">_</div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-xs font-semibold text-[#5e6ad2] uppercase mb-4 block">CALENDAR SYNC</span>
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">
              Plans that fit your actual calendar.
            </h2>
            <p className="text-lg text-[#c6c5d5]">
              Stop managing a list and a calendar separately. 11th Hour treats your time as a finite resource, automatically carving out slots for tasks between your meetings.
            </p>
          </div>
        </section>

        {/* Feature Grid (Bento) */}
        <section className="max-w-[1280px] mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="surface-1 hairline p-6 lg:p-12 rounded-xl flex flex-col justify-between min-h-[280px]">
              <span className="material-symbols-outlined text-[#5e6ad2] text-4xl">inventory_2</span>
              <div>
                <h3 className="text-2xl font-bold mb-2">Scoped by design</h3>
                <p className="text-[#c6c5d5]">The app physically limits how many tasks you can see at once to prevent paralysis.</p>
              </div>
            </div>
            <div className="surface-1 hairline p-6 lg:p-12 rounded-xl flex flex-col justify-between min-h-[280px]">
              <span className="material-symbols-outlined text-[#5e6ad2] text-4xl">forum</span>
              <div>
                <h3 className="text-2xl font-bold mb-2">Calendar that talks back</h3>
                <p className="text-[#c6c5d5]">If a meeting is added that kills your task time, we notify you immediately to reschedule.</p>
              </div>
            </div>
            <div className="surface-1 hairline p-6 lg:p-12 rounded-xl flex flex-col justify-between min-h-[280px]">
              <span className="material-symbols-outlined text-[#5e6ad2] text-4xl">smart_toy</span>
              <div>
                <h3 className="text-2xl font-bold mb-2">An agent, not a checklist</h3>
                <p className="text-[#c6c5d5]">AI that proactively suggests what to delete, not just what to do next.</p>
              </div>
            </div>
            <div className="surface-1 hairline p-6 lg:p-12 rounded-xl flex flex-col justify-between min-h-[280px]">
              <span className="material-symbols-outlined text-[#5e6ad2] text-4xl">calculate</span>
              <div>
                <h3 className="text-2xl font-bold mb-2">Capacity, calculated</h3>
                <p className="text-[#c6c5d5]">We use historical data to learn your "real" velocity. If you're always late on emails, we buffer them.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-[1280px] mx-auto px-6 pb-12">
          <div className="surface-1 hairline rounded-xl p-12 lg:p-24 flex flex-col items-center text-center overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-64 h-64 border border-[#5e6ad2]/10 rounded-full"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 border border-[#5e6ad2]/10 rounded-full"></div>
            <h2 className="text-3xl lg:text-5xl font-bold mb-8 max-w-2xl relative z-10">
              Ready to stop guessing what you can actually finish today?
            </h2>
            <div className="flex flex-col items-center gap-6 relative z-10">
              <button 
                onClick={() => window.location.href = 'http://localhost:5000/api/auth/google'}
                className="btn-primary flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-bold cursor-pointer"
              >
                <img 
                  alt="G" 
                  className="w-6 h-6 bg-white rounded-full p-0.5" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlmLMS0R5T9ida7wY5ajr4p1u0paxLX0gsGoympI5DDX9l0bDQpyUufL6Xu9PQ9-JXy4TtwjAEJZI5KvUT1WlJaaMz8LRnLXc-thH2dK-KQMxfY9M08TuVMz2R2smLrK7F2LeS4eWotovsW9pfkZLuXxUULdeT9m5rZA5_co62OifJOjnpJNe0O_ug1EHeOmKPjOmgh64JePRK1-iJUqJFsFveoiZALiIzGQW_GSuJEXNB9miGiQ4_lxR8FIpZmJYlYwuTLeBLEp4" 
                />
                Continue with Google
              </button>
              <p className="text-sm text-[#c6c5d5]">No credit card. No trial. Just a better brain.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="hairline-t py-12">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-1 items-center md:items-start">
            <span className="text-lg font-bold text-[#dee3ec]">11th Hour</span>
            <p className="text-sm text-[#c6c5d5]">Built for the hackathon. Powered by AI.</p>
          </div>
          <p className="text-sm text-[#c6c5d5]/50">© 2024 11th Hour. Engineered for focus.</p>
        </div>
      </footer>
    </div>
  );
};
