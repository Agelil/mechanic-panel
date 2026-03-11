import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, Trash2, FileText, Image, Loader2, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderDoc {
  id: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  doc_type: string;
  created_at: string;
  created_by: string | null;
}

interface Props {
  appointmentId: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  jpg: Image,
  jpeg: Image,
  png: Image,
  webp: Image,
};

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || File;
}

export default function OrderDocumentsBlock({ appointmentId }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadDocs = async () => {
    const { data } = await supabase
      .from("appointment_documents")
      .select("*")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false });
    setDocs((data as OrderDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [appointmentId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${appointmentId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("order-documents")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from("order-documents")
        .getPublicUrl(path);

      const ext = file.name.split(".").pop()?.toLowerCase() || "file";
      const docType = ext === "pdf" ? "document" : "photo";

      const { data: { session } } = await supabase.auth.getSession();

      const { error: dbErr } = await supabase
        .from("appointment_documents")
        .insert({
          appointment_id: appointmentId,
          file_name: file.name,
          file_url: publicUrl,
          doc_type: docType,
          created_by: session?.user?.id || null,
        });
      if (dbErr) throw dbErr;

      toast({ title: "Файл загружен" });
      await loadDocs();
    } catch (e: any) {
      toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDelete = async (doc: OrderDoc) => {
    if (!confirm(`Удалить файл "${doc.file_name}"?`)) return;
    setDeleting(doc.id);
    try {
      // Extract storage path from URL
      const urlParts = doc.file_url.split("/order-documents/");
      if (urlParts[1]) {
        await supabase.storage.from("order-documents").remove([decodeURIComponent(urlParts[1])]);
      }
      await supabase.from("appointment_documents").delete().eq("id", doc.id);
      toast({ title: "Файл удалён" });
      await loadDocs();
    } catch (e: any) {
      toast({ title: "Ошибка удаления", description: e.message, variant: "destructive" });
    }
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs text-orange uppercase tracking-widest">
          Документы по заказу ({docs.length})
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 font-mono text-xs border border-border px-3 py-1.5 hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Загрузить файл
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleUpload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 text-orange animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="border-2 border-dashed border-border py-6 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="w-8 h-8 opacity-30" />
          <span className="font-mono text-xs">Документы не загружены</span>
          <span className="font-mono text-[10px] text-muted-foreground">PDF, JPG, PNG — до 20 МБ</span>
        </div>
      ) : (
        <div className="bg-background border border-border divide-y divide-border">
          {docs.map((doc) => {
            const Icon = getFileIcon(doc.file_name);
            const isImage = ["jpg", "jpeg", "png", "webp"].includes(
              doc.file_name.split(".").pop()?.toLowerCase() || ""
            );
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface/40 transition-colors">
                {isImage ? (
                  <img
                    src={doc.file_url}
                    alt={doc.file_name}
                    className="w-10 h-10 object-cover border border-border flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-orange/10 border border-orange/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-orange" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">{doc.file_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-muted-foreground hover:text-orange border border-border hover:border-orange transition-colors"
                    title="Скачать"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deleting === doc.id}
                    className="p-2 text-muted-foreground hover:text-destructive border border-border hover:border-destructive transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    {deleting === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
