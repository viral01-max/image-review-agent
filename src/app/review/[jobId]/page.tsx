"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface ProcessedImage {
  processed_image_id: string;
  shot_type: string;
  source: string;
  public_url: string | null;
  prompt_used: string | null;
  enhancement_skipped: boolean;
  brand_decision: string | null;
}

interface JobData {
  job_id: string;
  status: string;
  current_stage: number;
  original: {
    filename: string;
    size_bytes: number;
    width: number | null;
    height: number | null;
    preview_url: string | null;
  };
  quality: { route: string; backgroundType: string; notes: string } | null;
  processed_images: ProcessedImage[];
  rejection_reason: string | null;
}

const STAGE_NAMES = ["Validating", "Moderating", "Analyzing Quality", "Processing", "Ready for Review"];
const SHOT_LABELS: Record<string, string> = { hero: "Hero Shot", flat_lay: "Flat Lay", angle: "Angle Shot", original: "Original" };
const SOURCE_LABELS: Record<string, string> = { openai: "AI Generated", photoroom: "Enhanced", original: "Original Upload" };
const REJECT_REASONS = [
  { value: "wrong_product", label: "Wrong product" },
  { value: "poor_quality", label: "Poor quality" },
  { value: "not_what_i_wanted", label: "Not what I wanted" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-surface-100 text-surface-600",
    validating: "bg-blue-50 text-blue-700",
    moderating: "bg-blue-50 text-blue-700",
    quality_checking: "bg-blue-50 text-blue-700",
    enhancing: "bg-purple-50 text-purple-700",
    generating: "bg-purple-50 text-purple-700",
    awaiting_brand_review: "bg-blue-50 text-blue-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    paused: "bg-orange-50 text-orange-700",
    flagged: "bg-yellow-50 text-yellow-700",
    pending_resubmission: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`badge ${styles[status] ?? styles.pending}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ProcessingState({ stage }: { stage: number }) {
  return (
    <div className="card max-w-lg mx-auto p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-surface-900 mb-2">Processing your images</h2>
      <p className="text-surface-500 mb-8">We&apos;re checking and enhancing your photos. This usually takes 30–90 seconds.</p>
      <div className="w-full bg-surface-100 rounded-full h-2.5 mb-3 overflow-hidden">
        <div className="bg-brand-500 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((stage / 5) * 100, 100)}%` }} />
      </div>
      <p className="text-sm text-surface-400">Stage {stage} of 5 — {STAGE_NAMES[stage - 1] ?? "Starting"}</p>
      <div className="flex justify-center gap-3 mt-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`stage-dot ${s < stage ? "completed" : s === stage ? "active" : "pending"}`} />
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  image, decision, rejectionReason, onApprove, onReject, onReasonChange, onZoom,
}: {
  image: ProcessedImage;
  decision: "approved" | "rejected" | null;
  rejectionReason: string | null;
  onApprove: () => void;
  onReject: () => void;
  onReasonChange: (r: string) => void;
  onZoom: () => void;
}) {
  const done = image.brand_decision !== null;
  return (
    <div className={`card overflow-hidden transition-all duration-300 ${
      decision === "approved" ? "ring-2 ring-success ring-offset-2" : decision === "rejected" ? "ring-2 ring-danger ring-offset-2" : ""
    }`}>
      <div className="aspect-square bg-surface-50 relative cursor-zoom-in group" onClick={onZoom}>
        {image.public_url ? (
          <img src={image.public_url} alt={SHOT_LABELS[image.shot_type] ?? image.shot_type} className="w-full h-full object-contain p-4" />
        ) : (
          <div className="w-full h-full skeleton" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-surface-700 shadow">Click to zoom</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-surface-900">{SHOT_LABELS[image.shot_type] ?? image.shot_type}</h3>
            <p className="text-xs text-surface-400">{SOURCE_LABELS[image.source] ?? image.source}</p>
          </div>
          {image.enhancement_skipped && <span className="badge bg-yellow-50 text-yellow-700">Skipped</span>}
        </div>
        {!done && (
          <div className="flex gap-2">
            <button onClick={onApprove} className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
              decision === "approved" ? "bg-success text-white" : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}>✓ Approve</button>
            <button onClick={onReject} className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
              decision === "rejected" ? "bg-danger text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}>✗ Reject</button>
          </div>
        )}
        {decision === "rejected" && (
          <select value={rejectionReason ?? ""} onChange={(e) => onReasonChange(e.target.value)}
            className="w-full mt-3 px-3 py-2 text-sm border border-surface-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-200">
            <option value="">Select reason...</option>
            {REJECT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}
        {done && <div className="mt-2"><StatusBadge status={image.brand_decision!} /></div>}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, { decision: "approved" | "rejected"; reason: string | null }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/images/job/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      setJob(await res.json());
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    const id = setInterval(() => {
      if (job && !["awaiting_brand_review", "approved", "rejected", "pending_resubmission"].includes(job.status)) fetchJob();
    }, 3000);
    return () => clearInterval(id);
  }, [fetchJob, job?.status]);

  const handleSubmit = async () => {
    if (Object.keys(decisions).length === 0) return;
    setSubmitting(true);
    try {
      await Promise.all(Object.entries(decisions).map(([pid, { decision, reason }]) =>
        fetch(`/api/images/job/${jobId}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processed_image_id: pid, decision, rejection_reason: decision === "rejected" ? reason : undefined }),
        })
      ));
      setSubmitted(true);
      fetchJob();
    } catch { setError("Failed to submit. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="card p-10 text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-surface-500">Loading...</p>
      </div>
    </div>
  );

  if (error || !job) return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="card p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center text-2xl">⚠</div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">{error ?? "Job not found"}</h2>
      </div>
    </div>
  );

  if (!["awaiting_brand_review", "approved", "rejected", "pending_resubmission"].includes(job.status))
    return <div className="max-w-5xl mx-auto px-6 py-16"><ProcessingState stage={job.current_stage} /></div>;

  if (job.status === "rejected") return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="card p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center text-2xl">✗</div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Image Rejected</h2>
        <p className="text-surface-500">{job.rejection_reason?.replace(/_/g, " ") ?? "Unknown reason"}</p>
      </div>
    </div>
  );

  if (submitted || job.status === "approved") return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="card p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center text-3xl">✓</div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Decisions Submitted</h2>
        <p className="text-surface-500">Your approved images have been added to the listing.</p>
      </div>
    </div>
  );

  const undecided = job.processed_images.filter((img) => img.brand_decision === null);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-surface-900">Review Your Images</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-surface-500">We&apos;ve processed your image. Pick the ones you&apos;d like to use. You can approve multiple.</p>
      </div>

      {job.quality && (
        <div className="card p-4 mb-6 bg-surface-50">
          <div className="flex items-center gap-6 text-sm">
            <div><span className="text-surface-400">Route: </span><span className="font-semibold">{job.quality.route.replace(/_/g, " ")}</span></div>
            <div><span className="text-surface-400">Background: </span><span className="font-semibold">{job.quality.backgroundType}</span></div>
            {job.quality.notes && <div className="flex-1 text-surface-400 truncate">{job.quality.notes}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card overflow-hidden opacity-75">
          <div className="aspect-square bg-surface-100 relative cursor-zoom-in" onClick={() => job.original.preview_url && setZoomedImage(job.original.preview_url)}>
            {job.original.preview_url ? (
              <img src={job.original.preview_url} alt="Original" className="w-full h-full object-contain p-4" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-surface-400 text-sm">Preview unavailable</div>
            )}
            <div className="absolute top-3 left-3"><span className="badge bg-surface-800/70 text-white backdrop-blur">Original</span></div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-surface-600">Your Upload</h3>
            <p className="text-xs text-surface-400">{job.original.filename} • {Math.round(job.original.size_bytes / 1024)}KB</p>
          </div>
        </div>

        {undecided.map((img) => (
          <ImageCard
            key={img.processed_image_id}
            image={img}
            decision={decisions[img.processed_image_id]?.decision ?? null}
            rejectionReason={decisions[img.processed_image_id]?.reason ?? null}
            onApprove={() => setDecisions((p) => ({ ...p, [img.processed_image_id]: { decision: "approved", reason: null } }))}
            onReject={() => setDecisions((p) => ({ ...p, [img.processed_image_id]: { decision: "rejected", reason: null } }))}
            onReasonChange={(r) => setDecisions((p) => ({ ...p, [img.processed_image_id]: { ...p[img.processed_image_id], reason: r } }))}
            onZoom={() => img.public_url && setZoomedImage(img.public_url)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-surface-200 -mx-6 px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-surface-500">{Object.keys(decisions).length} of {undecided.length} reviewed</p>
        <button onClick={handleSubmit} disabled={Object.keys(decisions).length === 0 || submitting} className="btn-primary flex items-center gap-2">
          {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : "Submit decisions →"}
        </button>
      </div>

      {zoomedImage && (
        <div className="image-overlay" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed" className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-modal" />
        </div>
      )}
    </div>
  );
}
