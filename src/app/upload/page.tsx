"use client";
import { useState, useRef, useCallback } from "react";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";
interface JobStatus { job_id: string; status: string; current_stage: number; processed_images: Array<{ processed_image_id: string; shot_type: string; source: string; public_url: string | null; brand_decision: string | null; }>; rejection_reason: string | null; }
const STAGES = [{ n: 1, label: "Validating" }, { n: 2, label: "Moderating" }, { n: 3, label: "Quality check" }, { n: 4, label: "Processing" }, { n: 5, label: "Ready" }];
const TERMINAL = ["approved","rejected","awaiting_brand_review","flagged","paused"];
export default function UploadPage() {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const brandId = params.get("brand_id") ?? "00000000-0000-0000-0000-000000000001";
    const listingId = params.get("listing_id") ?? "00000000-0000-0000-0000-000000000002";
    const [state, setState] = useState<UploadState>("idle");
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [decisions, setDecisions] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = useCallback((f: File) => {
        if (!f.type.match(/image\/(jpeg|png|webp)/)) { setError("Only JPG, PNG or WebP accepted."); return; }
        setFile(f); setPreview(URL.createObjectURL(f)); setError(null);
  }, []);

  const startUpload = async () => {
        if (!file) return; setState("uploading"); setError(null);
        try {
                const r = await fetch("/api/images/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId, listing_id: listingId, filename: file.name, size_bytes: file.size, mime_type: file.type }) });
                if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
                const { job_id, upload_url } = await r.json();
                setJobId(job_id);
                const s3 = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
                if (!s3.ok) throw new Error("Failed to upload to storage");
                setState("processing");
                pollRef.current = setInterval(async () => {
                          try { const pr = await fetch(`/api/images/job/${job_id}`); const data = await pr.json(); setJob(data); if (TERMINAL.includes(data.status)) { clearInterval(pollRef.current!); setState("done"); } } catch {}
                }, 3000);
        } catch (e: any) { setState("error"); setError(e.message); }
  };

  const submitDecisions = async () => {
        if (!jobId) return; setSubmitting(true);
        try { await Promise.all(Object.entries(decisions).map(([pid, d]) => fetch(`/api/images/job/${jobId}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processed_image_id: pid, decision: d }) }))); setSubmitted(true); } catch { setError("Failed to submit."); }
        setSubmitting(false);
  };

  const reset = () => { if (pollRef.current) clearInterval(pollRef.current); setState("idle"); setFile(null); setPreview(null); setJobId(null); setJob(null); setError(null); setDecisions({}); setSubmitted(false); };

  if (submitted) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center"><h2 className="text-xl font-bold mb-2">Images submitted!</h2>h2><p className="text-gray-500 mb-6">Your approved images have been added to the listing.</p>p><button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Upload another</button>button></div>div></div>div>);
    if (job?.status === "rejected") return (<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center"><h2 className="text-xl font-bold mb-2">Image rejected</h2>h2><p className="text-gray-500 mb-6">{job.rejection_reason?.replace(/_/g, " ") ?? "Policy violation"}</p>p><button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Try another</button>button></div>div></div>div>);
  
    return (<div className="min-h-screen bg-gray-50"><div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10"><h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Product Image</h1>h1><p className="text-gray-500">Upload your product photo. We will automatically validate, enhance, and prepare it for your listing.</p>p></div>div>
    
      {state === "idle" && (<div className="space-y-6">
            <div onDrop={(e: any) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => inputRef.current?.click()} className={"bg-white rounded-2xl shadow p-12 text-center cursor-pointer border-2 border-dashed transition " + (dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400")}>
                    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {preview ? (<div><img src={preview} alt="Preview" className="max-h-64 mx-auto object-contain rounded-xl mb-3" /><p className="text-gray-600 font-medium">{file?.name}</p>p></div>div>) : (<div><p className="text-gray-700 font-semibold">Drop your image here, or click to browse</p>p><p className="text-gray-400 text-sm mt-1">JPG, PNG or WebP - Max 25MB</p>p></div>div>)}
            </div>div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>div>}
        {file && <div className="flex gap-3"><button onClick={startUpload} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700">Upload and process</button>button><button onClick={() => { setFile(null); setPreview(null); }} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600">Clear</button>button></div>div>}
      </div>div>)}
    
      {state === "uploading" && (<div className="bg-white rounded-2xl shadow p-12 text-center"><div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /><p className="text-gray-700 font-semibold">Uploading image...</p>p></div>div>)}
    
      {(state === "processing" || (state === "done" && job?.status !== "awaiting_brand_review")) && job && (<div className="bg-white rounded-2xl shadow p-10 text-center">
            <div className="w-10 h-10 mx-auto mb-6 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Processing your image</h2>h2>
            <p className="text-gray-500 mb-8">This usually takes 30-90 seconds.</p>p>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden"><div className="bg-blue-500 h-full rounded-full transition-all duration-700" style={{ width: Math.min((job.current_stage/5)*100,100)+"%" }} /></div>div>
            <p className="text-sm text-gray-400 mb-6">Stage {job.current_stage} of 5 - {STAGES[job.current_stage-1]?.label ?? "Starting"}</p>p>
            <div className="flex justify-center gap-4">{STAGES.map(s => (<div key={s.n}><div className={"w-3 h-3 rounded-full mx-auto mb-1 " + (s.n < job.current_stage ? "bg-green-500" : s.n === job.current_stage ? "bg-blue-500 ring-4 ring-blue-200" : "bg-gray-300")} /><p className="text-xs text-gray-400 hidden sm:block">{s.label}</p>p></div>div>))}</div>div>
      </div>div>)}
    
      {state === "done" && job?.status === "awaiting_brand_review" && !submitted && (<div>
            <div className="mb-6"><h2 className="text-xl font-bold mb-1">Review processed images</h2>h2><p className="text-gray-500">Approve the images you want on your listing.</p>p></div>div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">{job.processed_images.map(img => (<div key={img.processed_image_id} className={"bg-white rounded-xl shadow overflow-hidden " + (decisions[img.processed_image_id]==="approved" ? "ring-2 ring-green-500" : decisions[img.processed_image_id]==="rejected" ? "ring-2 ring-red-400" : "")}>
                    <div className="aspect-square bg-gray-50 p-3">{img.public_url ? <img src={img.public_url} alt={img.shot_type} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-gray-200 animate-pulse rounded" />}</div>div>
                    <div className="p-3"><p className="text-sm font-semibold capitalize mb-2">{img.shot_type.replace(/_/g," ")}</p>p>
                              <div className="flex gap-1.5"><button onClick={() => setDecisions(p => ({...p, [img.processed_image_id]: "approved"}))} className={"flex-1 py-1.5 rounded-lg text-xs font-semibold " + (decisions[img.processed_image_id]==="approved" ? "bg-green-500 text-white" : "bg-green-50 text-green-700")}>Use</button>button><button onClick={() => setDecisions(p => ({...p, [img.processed_image_id]: "rejected"}))} className={"flex-1 py-1.5 rounded-lg text-xs font-semibold " + (decisions[img.processed_image_id]==="rejected" ? "bg-red-500 text-white" : "bg-red-50 text-red-700")}>Skip</button>button></div>div>
                    </div>div></div>div>))}</div>div>
            <div className="flex items-center justify-between bg-white border rounded-2xl px-6 py-4 shadow-lg sticky bottom-6"><p className="text-sm text-gray-500">{Object.values(decisions).filter(d=>d==="approved").length} selected</p>p><button onClick={submitDecisions} disabled={!Object.keys(decisions).length || submitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50">{submitting ? "Saving..." : "Confirm selection"}</button>button></div>div>
      </div>div>)}
    
      {state === "error" && (<div className="bg-white rou</div>nded-2xl shadow p-10 text-center"><h2 className="text-xl font-bold mb-2">Something went wrong</h2>h2><p className="text-gray-500 mb-6">{error}</p>p><button onClick={reset} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Try again</button>button></div>div>)}
    </div>div></div>div>);
}
</div>
