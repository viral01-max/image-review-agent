import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          AI-Powered Pipeline
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-surface-900 mb-4">
          Image Review Agent
        </h1>
        <p className="text-lg text-surface-500 max-w-2xl mx-auto">
          Validate, moderate, enhance, and generate professional product images
          — automatically. Brands upload, AI processes, humans approve.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link
          href="/review/demo"
          className="card p-8 hover:shadow-elevated transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <circle cx="10" cy="13" r="2" />
              <path d="m20 17-1.09-1.09a2 2 0 0 0-2.82 0L10 22" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-surface-900">Review Images</h2>
          <p className="text-surface-500">
            Open the brand review panel to approve or reject processed images.
          </p>
        </Link>

        <div className="card p-8 border-dashed opacity-70">
          <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mb-4">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-surface-900">Upload Images</h2>
          <p className="text-surface-500">
            Use the API to upload images programmatically. See the docs for endpoint details.
          </p>
        </div>
      </div>

      <div className="card p-8">
        <h3 className="text-lg font-bold mb-6 text-surface-900">Pipeline Stages</h3>
        <div className="flex items-center justify-between gap-4">
          {[
            { num: 1, label: "Validate", desc: "Format, size, resolution" },
            { num: 2, label: "Moderate", desc: "AWS Rekognition" },
            { num: 3, label: "Quality", desc: "GPT-4o Vision analysis" },
            { num: 4, label: "Enhance / Generate", desc: "PhotoRoom + DALL-E" },
            { num: 5, label: "Brand Review", desc: "Approve or reject" },
          ].map((stage, i) => (
            <div key={stage.num} className="flex items-center gap-4 flex-1">
              <div className="text-center flex-1">
                <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 font-bold flex items-center justify-center mx-auto mb-2">
                  {stage.num}
                </div>
                <div className="text-sm font-semibold text-surface-800">{stage.label}</div>
                <div className="text-xs text-surface-400 mt-0.5">{stage.desc}</div>
              </div>
              {i < 4 && (
                <div className="w-8 h-px bg-surface-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 card p-8">
        <h3 className="text-lg font-bold mb-4 text-surface-900">API Endpoints</h3>
        <div className="space-y-3 font-mono text-sm">
          <div className="flex items-center gap-3">
            <span className="badge bg-green-100 text-green-800">POST</span>
            <code className="text-surface-600">/api/images/upload</code>
            <span className="text-surface-400 text-xs font-sans">Create job + signed upload URL</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-green-100 text-green-800">POST</span>
            <code className="text-surface-600">/api/images/upload-bulk</code>
            <span className="text-surface-400 text-xs font-sans">Batch upload (up to 50)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-blue-100 text-blue-800">GET</span>
            <code className="text-surface-600">/api/images/job/:jobId</code>
            <span className="text-surface-400 text-xs font-sans">Job status + processed images</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-green-100 text-green-800">POST</span>
            <code className="text-surface-600">/api/images/job/:jobId/decide</code>
            <span className="text-surface-400 text-xs font-sans">Approve or reject</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-blue-100 text-blue-800">GET</span>
            <code className="text-surface-600">/api/images/batch/:batchId</code>
            <span className="text-surface-400 text-xs font-sans">Batch status summary</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-blue-100 text-blue-800">GET</span>
            <code className="text-surface-600">/api/images/listing/:listingId</code>
            <span className="text-surface-400 text-xs font-sans">All approved images</span>
          </div>
        </div>
      </div>
    </main>
  );
}
