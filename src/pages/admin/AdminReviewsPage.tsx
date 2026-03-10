import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, CheckCircle2, XCircle, Eye, EyeOff, MessageSquare, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  appointment_id: string | null;
  phone: string | null;
  client_name: string | null;
  rating: number;
  feedback: string | null;
  is_published: boolean;
  created_at: string;
}

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "pending" | "negative">("all");

  const load = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("reviews").update({ is_published: !current }).eq("id", id);
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_published: !current } : r));
    toast({ title: current ? "Отзыв скрыт" : "Отзыв опубликован" });
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Удалить отзыв?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Отзыв удалён" });
  };

  const filtered = reviews.filter((r) => {
    if (filter === "published") return r.is_published;
    if (filter === "pending") return !r.is_published;
    if (filter === "negative") return r.rating <= 3;
    return true;
  });

  const counts = {
    all: reviews.length,
    published: reviews.filter((r) => r.is_published).length,
    pending: reviews.filter((r) => !r.is_published).length,
    negative: reviews.filter((r) => r.rating <= 3).length,
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl tracking-wider">ОТЗЫВЫ</h1>
          <p className="font-mono text-sm text-muted-foreground">Управление репутацией</p>
        </div>
        <div className="text-right">
          <div className="font-display text-5xl text-orange">{avgRating}</div>
          <div className="flex items-center justify-end gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`w-4 h-4 ${parseFloat(avgRating) >= s ? "text-orange fill-orange" : "text-muted-foreground"}`} />
            ))}
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">{reviews.length} отзывов</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border mb-6">
        {[
          { key: "all", label: "Всего", value: counts.all },
          { key: "published", label: "Опубликовано", value: counts.published },
          { key: "pending", label: "На модерации", value: counts.pending },
          { key: "negative", label: "Негативных", value: counts.negative },
        ].map((stat) => (
          <button
            key={stat.key}
            onClick={() => setFilter(stat.key as typeof filter)}
            className={`bg-background p-4 text-center transition-colors hover:bg-surface ${filter === stat.key ? "bg-surface border-b-2 border-orange" : ""}`}
          >
            <div className={`font-display text-3xl ${stat.key === "negative" && stat.value > 0 ? "text-destructive" : "text-orange"}`}>
              {stat.value}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{stat.label}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="font-mono text-sm text-muted-foreground">Отзывов нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <div
              key={review.id}
              className={`bg-surface border-2 p-5 transition-colors ${
                review.rating <= 3 ? "border-destructive/30" :
                review.is_published ? "border-green-500/30" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${review.rating >= s ? "text-orange fill-orange" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    {review.is_published ? (
                      <span className="font-mono text-xs text-green-400 border border-green-400/30 px-2 py-0.5">
                        Опубликован
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground border border-border px-2 py-0.5">
                        На модерации
                      </span>
                    )}
                    {review.rating <= 3 && (
                      <span className="font-mono text-xs text-destructive border border-destructive/30 px-2 py-0.5">
                        Требует ответа
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-2">
                    <span className="font-mono text-sm font-bold">{review.client_name || "Аноним"}</span>
                    {review.phone && (
                      <span className="font-mono text-xs text-muted-foreground">{review.phone}</span>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>

                  {review.feedback && (
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed border-l-2 border-orange/30 pl-3 mt-2">
                      {review.feedback}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePublish(review.id, review.is_published)}
                    className={`p-2 border transition-colors ${
                      review.is_published
                        ? "border-border text-muted-foreground hover:border-orange hover:text-orange"
                        : "border-green-500/30 text-green-400 hover:border-green-400"
                    }`}
                    title={review.is_published ? "Скрыть" : "Опубликовать"}
                  >
                    {review.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteReview(review.id)}
                    className="p-2 border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
