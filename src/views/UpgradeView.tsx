const CONTACT_EMAIL = 'salvahardin492@gmail.com';

const FEATURES = [
  { icon: '📚', title: 'Full Question Bank', desc: 'MRCP + Passmedicine + Pastest — thousands of past-paper questions' },
  { icon: '🏆', title: 'Custom Mock Tests', desc: 'Build timed exams by system, source, and question count' },
  { icon: '📖', title: 'Passmedicine Textbooks', desc: 'Full textbook library with notes and highlights' },
  { icon: '💡', title: 'Clinical Pearls', desc: 'High-yield one-liners in flashcard and list format' },
  { icon: '📊', title: 'Performance Analytics', desc: 'Detailed stats, accuracy by system, progress tracking' },
  { icon: '♾️', title: 'Lifetime Access', desc: 'One payment, no renewals, no monthly fees' },
];

interface UpgradeViewProps {
  onGoToDaily: () => void;
}

export default function UpgradeView({ onGoToDaily }: UpgradeViewProps) {
  const subject = encodeURIComponent('MRCP QBank Subscription');
  const body = encodeURIComponent(
    'Hi,\n\nI would like to purchase access to MRCP QBank.\n\nMy registered email: \n\nPlease confirm payment details.\n\nThank you.',
  );
  const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">

      {/* Decorative blobs */}
      <div className="fixed -top-32 -right-32 w-96 h-96 rounded-full bg-blue-600/10 pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/10 pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-12 relative">

        {/* Lock icon */}
        <div className="w-20 h-20 bg-white/10 border border-white/20 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-2xl">
          🔐
        </div>

        {/* Heading */}
        <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Premium Access Required
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white text-center tracking-tight mb-3 max-w-lg">
          Unlock Full MRCP QBank
        </h1>
        <p className="text-blue-200 text-center text-base max-w-md mb-10">
          Get complete access to all study tools — question bank, mock tests, textbooks, clinical pearls, and analytics.
        </p>

        {/* Price Card */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden mb-8">
          {/* Top gradient bar */}
          <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8">
            <div className="text-center mb-6">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">One-Time Payment</div>
              <div className="flex items-end justify-center gap-1">
                <span className="text-2xl font-bold text-gray-400">$</span>
                <span className="text-7xl font-extrabold text-gray-900 leading-none">30</span>
                <span className="text-lg font-semibold text-gray-400 mb-2">USD</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Lifetime access · No renewals</div>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-7">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-base flex-shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{f.title}</div>
                    <div className="text-xs text-gray-500">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a
              href={mailtoLink}
              className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base py-4 rounded-2xl shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] transition-all"
            >
              📧 Get Access — $30 USD
            </a>

            <div className="mt-4 text-center text-xs text-gray-400">
              Email us at{' '}
              <a
                href={mailtoLink}
                className="text-blue-600 font-semibold hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h3 className="text-white font-bold text-sm mb-3">How it works</h3>
          <div className="space-y-2.5">
            {[
              { step: '1', text: 'Email us at the address above' },
              { step: '2', text: 'Send $30 USD via any method' },
              { step: '3', text: 'We activate your account within 24 hours' },
              { step: '4', text: 'Log out and back in to access everything' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <span className="text-blue-100 text-sm">{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Mock link */}
        <button
          onClick={onGoToDaily}
          className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm font-semibold transition-colors"
        >
          <span>🎯</span>
          Continue with free Daily Mock Exam
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
